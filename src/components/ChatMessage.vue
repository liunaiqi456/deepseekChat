<template>
  <div :class="['message', msg.sender]">
    <p>{{ msg.text }}</p >
  </div>
</template>

<script setup>
defineProps(["msg"]);
</script>

<style>
.message {
  padding: 10px;
  margin: 5px;
  border-radius: 5px;
}
.message.user {
  background: #e0f7fa;
  text-align: right;
}
.message.bot {
  background: #e3f2fd;
  text-align: left;
}
</style>