package com.agri.production.vo;

import com.agri.production.entity.GrowthRecord;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.Data;

import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

/**
 * 生长记录出参（页面 {@code GrowthRecord}）。
 *
 * <p>出参名按页面契约给（{@code plant_height→plantHeight}、{@code record_date→recordDate} 等），
 * 而不是把实体直接丢给前端：实体里的 {@code photos} 是 JSON 字符串，页面要的是
 * {@code photoUrls: string[]}；{@code recordDate} 是 {@code LocalDate}，页面对它做
 * {@code dayjs()} 解析，字符串形式最稳。</p>
 *
 * <p><b>onChain 为什么恒为 false</b>：本部署的链上存证（{@code agri_prod_chain_record}）按
 * {@code target_type} 只覆盖 HARVEST / QUALITY / TRACE 三类业务对象，生长记录既没有存证入口、
 * 也没有对应的 target_type。写 false 是**事实**（这几条记录确实不在链上），不是默认值填充；
 * 如果哪天生长记录也接存证，这里再改成按 target_type=TARGET_GROWTH 反查。</p>
 */
@Data
public class GrowthRecordVO {

    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private static final DateTimeFormatter DATETIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final ObjectMapper JSON = new ObjectMapper();

    private String recordId;
    /** 地块标识（当前为页面口径的平台侧标识，见 DDL 注释） */
    private String plotId;
    private String plotName;
    private String planId;
    private String cropId;
    private String cropName;
    private String growthStage;
    /** 株高（cm） */
    private java.math.BigDecimal plantHeight;
    private Integer leafCount;
    private java.math.BigDecimal leafAreaIndex;
    /** 1 弱 / 2 偏弱 / 3 正常 / 4 旺盛 */
    private Integer growthLevel;
    /** 0 无 / 1 轻 / 2 中 / 3 重 */
    private Integer pestLevel;
    private String pestInfo;
    private String weather;
    /** 照片地址列表（页面直接用） */
    private List<String> photoUrls;
    /** 照片原始字符串（JSON 数组或逗号分隔；页面的 resolveGrowthPhotos 也认这个字段） */
    private String photos;
    private String recorderId;
    private String recorderName;
    /** yyyy-MM-dd */
    private String recordDate;
    private String remark;
    /** 1 有效 0 停用 */
    private Integer status;
    /** 是否已上链（本部署恒为 false，见类注释） */
    private boolean onChain;
    /** yyyy-MM-dd HH:mm:ss */
    private String createdAt;

    public static GrowthRecordVO of(GrowthRecord entity) {
        if (entity == null) {
            return null;
        }
        GrowthRecordVO vo = new GrowthRecordVO();
        vo.recordId = entity.getRecordId();
        vo.plotId = entity.getPlotId();
        vo.plotName = entity.getPlotName();
        vo.planId = entity.getPlanId();
        vo.cropId = entity.getCropId();
        vo.cropName = entity.getCropName();
        vo.growthStage = entity.getGrowthStage();
        vo.plantHeight = entity.getPlantHeight();
        vo.leafCount = entity.getLeafCount();
        vo.leafAreaIndex = entity.getLeafAreaIndex();
        vo.growthLevel = entity.getGrowthLevel();
        vo.pestLevel = entity.getPestLevel();
        vo.pestInfo = entity.getPestInfo();
        vo.weather = entity.getWeather();
        vo.photos = entity.getPhotos();
        vo.photoUrls = parsePhotos(entity.getPhotos());
        vo.recorderId = entity.getRecorderId();
        vo.recorderName = entity.getRecorderName();
        vo.recordDate = entity.getRecordDate() == null ? null : DATE.format(entity.getRecordDate());
        vo.remark = entity.getRemark();
        vo.status = entity.getStatus();
        vo.onChain = false;
        vo.createdAt = entity.getCreateTime() == null ? null : DATETIME.format(entity.getCreateTime());
        return vo;
    }

    /**
     * 解析照片字段。
     *
     * <p>库里历史值有两种形态（JSON 数组字符串、逗号分隔），页面也有两套解析；
     * 这里统一归一成数组，免得同一行在不同页面显示不一致。解析不出来就返回空数组 ——
     * 而不是把整段文本当成一个"图片地址"塞给页面（那会渲染成一个必然裂图的 img）。</p>
     *
     * @param raw 库内原始字符串
     * @return 地址列表（可能为空）
     */
    public static List<String> parsePhotos(String raw) {
        List<String> result = new ArrayList<>();
        if (raw == null || raw.isBlank()) {
            return result;
        }
        String text = raw.trim();
        if (text.startsWith("[")) {
            try {
                List<String> parsed = JSON.readValue(text, new TypeReference<List<String>>() {
                });
                for (String item : parsed) {
                    if (item != null && !item.isBlank()) {
                        result.add(item.trim());
                    }
                }
                return result;
            } catch (Exception e) {
                // 不是合法 JSON 就按分隔符继续解析，不因为一处脏值丢掉整行照片
            }
        }
        for (String part : text.split("[,，\\s]+")) {
            if (!part.isBlank()) {
                result.add(part.trim());
            }
        }
        return result;
    }
}
