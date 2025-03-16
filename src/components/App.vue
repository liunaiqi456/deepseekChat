<template>
  <div class="app">
    <Sidebar />
    <ChatWindow />
  </div>
</template>

<script setup>
import Sidebar from "./components/Sidebar.vue";
import ChatWindow from "./components/ChatWindow.vue";
</script>

<style>
.app {
  display: flex;
  height: 100vh;
}
</style>