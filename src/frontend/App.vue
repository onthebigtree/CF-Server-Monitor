<template>
  <div>
    <ManagementNavigation />
    <router-view />
  </div>
</template>

<script setup>
import ManagementNavigation from './extensions/management/components/Navigation.vue'
import { useTheme } from './composables/useTheme'

const { initTheme } = useTheme()

initTheme()
</script>