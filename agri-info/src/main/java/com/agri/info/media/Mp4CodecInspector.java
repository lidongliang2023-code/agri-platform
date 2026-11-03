package com.agri.info.media;

import java.io.IOException;
import java.io.RandomAccessFile;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.Set;

/**
 * MP4 视频编码探测。
 *
 * <p>为什么必须在上传时拦一道：浏览器遇到解不了的编码（典型是手机拍的 H.265/HEVC）
 * <b>不会报错</b> —— {@code video.error} 是 null，{@code readyState} 能到 4，
 * 时长也读得出来，只有 {@code videoWidth} 是 0。表现出来就是"进度条在走、画面全黑"，
 * 运营完全无从判断是网络问题还是文件问题。</p>
 *
 * <p>实现上不引 mp4parser 之类依赖：只需要读 box 结构找到 {@code stsd} 里的 sample entry
 * 四字符码（{@code avc1} / {@code hvc1} / {@code av01} …），一百来行足够，也不必担心
 * 第三方库对超大文件的兼容性。</p>
 */
public final class Mp4CodecInspector {

    /** 浏览器与小程序的共同安全区：H.264（avc1/avc3）。 */
    private static final Set<String> PLAYABLE = Set.of("avc1", "avc3");

    /** 常见但当前不可用的编码，单独给出可读名字，便于错误提示直接说明原因。 */
    private static final Set<String> KNOWN_UNSUPPORTED = Set.of("hvc1", "hev1", "av01", "vp09", "mp4v");

    private Mp4CodecInspector() {
    }

    /** 探测结果。codec 为四字符码，playable 表示三端能否直接播。 */
    public record Codec(String codec, boolean playable, String label) {
        public static Codec unknown() {
            return new Codec("unknown", true, "未知（按可播放处理）");
        }
    }

    /**
     * 读取视频轨编码。
     *
     * <p>必须按 {@code hdlr} 的 handler_type 找 {@code vide} 轨，不能取第一个 {@code trak}：
     * mp4 里音频轨完全可以排在视频轨前面，那样会读到音频编码 {@code mp4a}，
     * 把一个正常的 H.264 视频误判成"不支持的编码"。</p>
     *
     * <p>探测不出来时返回 {@link Codec#unknown()} 并按"可播放"放行 —— 宁可漏拦，
     * 也不能因为解析器认不出某个合法变体就把运营的上传全堵死。</p>
     */
    public static Codec inspect(Path file) {
        try (RandomAccessFile raf = new RandomAccessFile(file.toFile(), "r")) {
            long length = raf.length();
            long moov = findBox(raf, 0, length, "moov");
            if (moov < 0) {
                return Codec.unknown();
            }
            long moovEnd = boxEnd(raf, moov, length);

            long cursor = moov + 8;
            while (cursor < moovEnd) {
                long trak = findBox(raf, cursor, moovEnd, "trak");
                if (trak < 0) {
                    break;
                }
                long trakEnd = boxEnd(raf, trak, moovEnd);
                if ("vide".equals(handlerType(raf, trak, trakEnd))) {
                    String codec = videoSampleEntry(raf, trak, trakEnd);
                    if (codec != null) {
                        return new Codec(codec, PLAYABLE.contains(codec), label(codec));
                    }
                }
                cursor = trakEnd;
            }
            return Codec.unknown();
        } catch (IOException | RuntimeException ignored) {
            return Codec.unknown();
        }
    }

    /** 取 trak 下 mdia > hdlr 的 handler_type（vide / soun / text …）。 */
    private static String handlerType(RandomAccessFile raf, long trak, long trakEnd) throws IOException {
        long mdia = findBox(raf, trak + 8, trakEnd, "mdia");
        if (mdia < 0) {
            return null;
        }
        long mdiaEnd = boxEnd(raf, mdia, trakEnd);
        long hdlr = findBox(raf, mdia + 8, mdiaEnd, "hdlr");
        if (hdlr < 0) {
            return null;
        }
        // hdlr: box头(8) + version/flags(4) + pre_defined(4) → handler_type(4)
        raf.seek(hdlr + 16);
        byte[] handler = new byte[4];
        raf.readFully(handler);
        return new String(handler, StandardCharsets.ISO_8859_1);
    }

    /** 取 mdia > minf > stbl > stsd 里第一个 sample entry 的四字符码。 */
    private static String videoSampleEntry(RandomAccessFile raf, long trak, long trakEnd) throws IOException {
        long mdia = findBox(raf, trak + 8, trakEnd, "mdia");
        if (mdia < 0) {
            return null;
        }
        long mdiaEnd = boxEnd(raf, mdia, trakEnd);
        long minf = findBox(raf, mdia + 8, mdiaEnd, "minf");
        if (minf < 0) {
            return null;
        }
        long minfEnd = boxEnd(raf, minf, mdiaEnd);
        long stbl = findBox(raf, minf + 8, minfEnd, "stbl");
        if (stbl < 0) {
            return null;
        }
        long stblEnd = boxEnd(raf, stbl, minfEnd);
        long stsd = findBox(raf, stbl + 8, stblEnd, "stsd");
        if (stsd < 0) {
            return null;
        }
        // stsd payload: version/flags(4) + entry_count(4) + 第一个 entry 的 size(4) + format(4)
        raf.seek(stsd + 8 + 8 + 4);
        byte[] fourcc = new byte[4];
        raf.readFully(fourcc);
        return new String(fourcc, StandardCharsets.ISO_8859_1);
    }

    public static String label(String codec) {
        return switch (codec) {
            case "avc1", "avc3" -> "H.264";
            case "hvc1", "hev1" -> "H.265 / HEVC";
            case "av01" -> "AV1";
            case "vp09" -> "VP9";
            case "mp4v" -> "MPEG-4 Part 2";
            default -> KNOWN_UNSUPPORTED.contains(codec) ? codec : "未知编码(" + codec + ")";
        };
    }

    /** 在 [start, end) 范围内按 box 结构线性查找指定类型，返回 box 起始偏移。 */
    private static long findBox(RandomAccessFile raf, long start, long end, String type) throws IOException {
        long pos = start;
        while (pos + 8 <= end) {
            raf.seek(pos);
            long size = raf.readInt() & 0xFFFFFFFFL;
            byte[] typeBytes = new byte[4];
            raf.readFully(typeBytes);
            String boxType = new String(typeBytes, StandardCharsets.ISO_8859_1);
            if (boxType.equals(type)) {
                return pos;
            }
            if (size == 1) {
                // 64 位 size：紧跟一个 8 字节长度
                size = raf.readLong();
            } else if (size == 0) {
                // size 为 0 表示延伸到父 box 末尾
                size = end - pos;
            }
            if (size < 8) {
                // 结构损坏，停止遍历，避免死循环
                return -1;
            }
            pos += size;
        }
        return -1;
    }

    private static long boxEnd(RandomAccessFile raf, long boxStart, long fallbackEnd) throws IOException {
        raf.seek(boxStart);
        long size = raf.readInt() & 0xFFFFFFFFL;
        if (size == 1) {
            size = raf.readLong();
        } else if (size == 0) {
            return fallbackEnd;
        }
        return size < 8 ? fallbackEnd : Math.min(boxStart + size, fallbackEnd);
    }
}
