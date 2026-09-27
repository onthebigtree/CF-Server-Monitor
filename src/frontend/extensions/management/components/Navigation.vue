<template>
  <nav v-if="enabled" class="management-nav" aria-label="管理导航">
    <router-link to="/">服务器监控</router-link>
    <router-link to="/management/users">用户与订阅</router-link>
    <router-link to="/admin">设置</router-link>
  </nav>
</template>
<script setup>
import { ref, watch, onMounted, onUnmounted } from "vue";
import { useRoute } from "vue-router";
import { managementRequest } from "../api";
const enabled = ref(false),
  route = useRoute();
let generation = 0;
async function refresh() {
  const current = ++generation;
  try {
    await managementRequest("get", "/status");
    if (current === generation) enabled.value = true;
  } catch {
    if (current === generation) enabled.value = false;
  }
}
watch(() => route.fullPath, refresh, { immediate: true });
onMounted(() => window.addEventListener("cfsm-auth-changed", refresh));
onUnmounted(() => {
  generation++;
  window.removeEventListener("cfsm-auth-changed", refresh);
});
</script>
<style scoped>
.management-nav {
  display: flex;
  gap: 20px;
  padding: 14px 24px;
  flex-wrap: wrap;
  border-bottom: 1px solid #8795aa40;
}
.management-nav a {
  color: inherit;
  text-decoration: none;
}
.management-nav .router-link-exact-active {
  color: #2563eb;
  font-weight: 600;
}
</style>
