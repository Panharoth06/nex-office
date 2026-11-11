<template>
  <input
    v-model="model"
    :type="type"
    :placeholder="placeholder"
    :disabled="disabled"
    :readonly="readonly"
    :aria-invalid="invalid || undefined"
    :class="classes"
    v-bind="$attrs"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'

defineOptions({ inheritAttrs: false })

type Variant = 'field' | 'title' | 'inline'
type InputType = 'text' | 'email' | 'search' | 'url' | 'tel'

const props = withDefaults(
  defineProps<{
    variant?: Variant
    type?: InputType
    placeholder?: string
    disabled?: boolean
    readonly?: boolean
    invalid?: boolean
  }>(),
  {
    variant: 'field',
    type: 'text',
    placeholder: '',
    disabled: false,
    readonly: false,
    invalid: false,
  },
)

const model = defineModel<string>({ default: '' })

const variants: Record<Variant, string> = {
  field:
    'w-full appearance-none rounded-lg border bg-white px-3 py-2 text-sm text-slate-800 ' +
    'placeholder:text-slate-400 transition focus:border-indigo-500 focus:outline-none ' +
    'focus:ring-2 focus:ring-indigo-500/20',
  title:
    'w-full appearance-none rounded border-b border-transparent bg-transparent px-1 py-0.5 ' +
    'text-sm font-semibold text-slate-800 transition hover:border-slate-300 ' +
    'focus:border-indigo-500 focus:outline-none',
  inline:
    'rounded bg-transparent px-2 py-1 text-xs text-slate-700 transition hover:bg-slate-100 ' +
    'focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20',
}

const classes = computed(() => [
  variants[props.variant],
  props.invalid ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20' : '',
  props.variant === 'field' && !props.invalid ? 'border-slate-300' : '',
  props.disabled ? 'cursor-not-allowed bg-slate-50 text-slate-400' : '',
])
</script>
