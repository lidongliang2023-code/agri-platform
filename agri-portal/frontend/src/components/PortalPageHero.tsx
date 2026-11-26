import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event;
type PortalPageHeroProps = {
  title: string;
  description: string;
  badge?: string;
  children?: VNodeChild;
};

/** 官网频道统一标题区；新增频道复用此组件及 portal-channel-page 内容容器。 */
export const PortalPageHero = defineComponent({
  name: "PortalPageHero",
  props: {
    title: null as unknown as PropType<PortalPageHeroProps["title"]>,
    description: null as unknown as PropType<PortalPageHeroProps["description"]>,
    badge: null as unknown as PropType<PortalPageHeroProps["badge"]>
  },
  setup(__props: PortalPageHeroProps, {
    slots: __slots
  }) {
    return () => {
      const view_prop_badge = __props.badge;
      const view_prop_title = __props.title;
      const view_prop_description = __props.description;
      return <section class="portal-page-hero">
      <div class="container portal-page-hero-inner">
        {view_prop_badge && <span class="portal-page-hero-badge">{view_prop_badge}</span>}
        <h1>{view_prop_title}</h1>
        <p>{view_prop_description}</p>
        {__slots.default?.()}
      </div>
    </section>;
    };
  }
});
