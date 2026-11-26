import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event;
interface BrandMarkProps {
  size?: number;
  className?: string;
}

/** 丰链云品牌图形：双叶生长 + 产业链节点。 */
export const BrandMark = defineComponent({
  name: "BrandMark",
  props: {
    size: null as unknown as PropType<BrandMarkProps["size"]>,
    className: null as unknown as PropType<BrandMarkProps["className"]>
  },
  setup(__props: BrandMarkProps, {
    slots: __slots
  }) {
    const id = computed(() => useId().replace(/:/g, ''));
    const bg = `${id.value}-brand-bg`;
    const gold = `${id.value}-brand-gold`;
    return () => {
      const view_prop_className = __props.className;
      const view_prop_size = __props.size;
      return <svg class={view_prop_className} width={view_prop_size ?? 36} height={view_prop_size ?? 36} viewBox="0 0 512 512" role="img" aria-label="丰链云">
      <defs>
        <linearGradient id={bg} x1="72" y1="52" x2="438" y2="462" gradientUnits="userSpaceOnUse">
          <stop stop-color="#0B4A35" /><stop offset=".58" stop-color="#087A50" />
          <stop offset="1" stop-color="#16B978" />
        </linearGradient>
        <linearGradient id={gold} x1="210" y1="354" x2="322" y2="434" gradientUnits="userSpaceOnUse">
          <stop stop-color="#FFE08A" /><stop offset="1" stop-color="#F4B93D" />
        </linearGradient>
      </defs>
      <rect x="28" y="28" width="456" height="456" rx="126" fill={`url(#${bg})`} />
      <path d="M104 365C171 325 197 274 213 219" fill="none" stroke="#A7F3D0" stroke-width="18" stroke-linecap="round" opacity=".2" />
      <path d="M408 365C341 325 315 274 299 219" fill="none" stroke="#BAE6FD" stroke-width="18" stroke-linecap="round" opacity=".18" />
      <g fill="#fff">
        <path d="M254 337V196" fill="none" stroke="#fff" stroke-width="28" stroke-linecap="round" />
        <path d="M250 274C207 278 173 250 164 202C211 198 244 226 250 274Z" />
        <path d="M262 231C268 182 302 155 351 160C347 209 313 237 262 231Z" />
      </g>
      <path d="M151 360C190 403 222 420 256 420C290 420 322 403 361 360" fill="none" stroke="#fff" stroke-width="24" stroke-linecap="round" />
      <path d="M151 360C190 403 222 420 256 420C290 420 322 403 361 360" fill="none" stroke={`url(#${gold})`} stroke-width="10" stroke-linecap="round" />
      <g fill={`url(#${gold})`}>
        <circle cx="151" cy="360" r="22" /><circle cx="256" cy="420" r="26" />
        <circle cx="361" cy="360" r="22" />
      </g>
      <g fill="#fff" opacity=".9">
        <circle cx="151" cy="360" r="7" /><circle cx="256" cy="420" r="8" />
        <circle cx="361" cy="360" r="7" />
      </g>
    </svg>;
    };
  }
});
