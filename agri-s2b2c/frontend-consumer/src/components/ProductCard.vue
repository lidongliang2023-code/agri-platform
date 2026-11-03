<template>
  <article class="pcard">
    <div class="thumb" @click="openDetail">
      <img v-if="image && !broken" :src="image" :alt="product.name" loading="lazy" @error="broken = true" />
      <span v-else class="ph">🌿</span>
      <span v-if="isFlash" class="tag flash">秒杀</span>
      <span v-else-if="badge" class="tag">{{ badge }}</span>
      <button
        v-if="showFav"
        type="button"
        class="fav"
        :class="{ on: favorited }"
        :title="favorited ? '取消收藏' : '收藏'"
        @click.stop="$emit('favorite')"
      >
        {{ favorited ? '♥' : '♡' }}
      </button>
    </div>

    <div class="pc-bd">
      <div class="pc-name" :title="product.name" @click="openDetail">{{ product.name }}</div>
      <div class="pc-meta">
        <span v-if="product.origin">{{ product.origin }}</span>
        <span v-if="product.origin && product.sales != null" class="dot" />
        <span v-if="product.sales != null">月销 {{ product.sales }}</span>
        <span v-if="!product.origin && product.sales == null">{{ product.categoryName || '产地直供' }}</span>
      </div>
      <div class="price-row">
        <span class="price"><span class="cur">¥</span>{{ money(sellPrice) }}</span>
        <span v-if="showCost && comparePrice" class="cost">¥{{ money(comparePrice) }}</span>
        <span v-if="product.unit" class="muted small">/{{ product.unit }}</span>
      </div>
      <div v-if="!compact" class="pc-ft">
        <button type="button" class="m-btn sm ghost" :disabled="stock === 0" @click="$emit('add')">
          {{ stock === 0 ? '已售罄' : '加入购物车' }}
        </button>
        <button type="button" class="m-btn sm" @click="openDetail">查看详情</button>
      </div>
    </div>
  </article>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { money, productImage } from '../utils/format'

const props = defineProps({
  product: { type: Object, required: true },
  favorited: { type: Boolean, default: false },
  showFav: { type: Boolean, default: true },
  showCost: { type: Boolean, default: true },
  compact: { type: Boolean, default: false },
  badge: { type: String, default: '' },
})
defineEmits(['favorite', 'add'])

const router = useRouter()
const broken = ref(false)
const image = computed(() => productImage(props.product))
/** 有活动价时用它作为售价，原价挪到删除线位置；没有活动就用商品价 + 划线原价。 */
const isFlash = computed(() => props.product?.activityType === 'FLASH' && props.product?.activityPrice != null)
const sellPrice = computed(() => (isFlash.value ? props.product.activityPrice : props.product.price))
const comparePrice = computed(() => {
  if (isFlash.value) return props.product.price
  return Number(props.product?.originalPrice) > Number(props.product?.price) ? props.product.originalPrice : null
})
const stock = computed(() => (props.product.stock == null ? null : Number(props.product.stock)))

watch(image, () => {
  broken.value = false
})

function openDetail() {
  if (props.product?.id) router.push(`/product/${props.product.id}`)
}
</script>

<style scoped>
.thumb .tag.flash {
  background: #d45b32;
  color: #fff;
}

.thumb .ph {
  font-size: 42px;
  opacity: .5;
}
</style>
