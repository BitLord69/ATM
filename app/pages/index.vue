<template>
  <div class="hero bg-base-300 container mx-auto my-6">
    <div class="hero-content text-center min-h-100">
      <div class="max-w">
        <h1 class="text-4xl font-bold my-2">
          Allround Tournament Manager
        </h1>
        <div class="carousel w-full h-80">
          <div id="slide1" class="carousel-item relative w-full">
            <img
              src="https://img.daisyui.com/images/stock/photo-1625726411847-8cbb60cc71e6.webp"
              class="w-full"
            >
            <div class="absolute left-5 right-5 top-1/2 flex -translate-y-1/2 transform justify-between">
              <a href="#slide4" class="btn btn-circle">❮</a>
              <a href="#slide2" class="btn btn-circle">❯</a>
            </div>
          </div>
          <div id="slide2" class="carousel-item relative w-full">
            <img
              src="https://img.daisyui.com/images/stock/photo-1609621838510-5ad474b7d25d.webp"
              class="w-full"
            >
            <div class="absolute left-5 right-5 top-1/2 flex -translate-y-1/2 transform justify-between">
              <a href="#slide1" class="btn btn-circle">❮</a>
              <a href="#slide3" class="btn btn-circle">❯</a>
            </div>
          </div>
          <div id="slide3" class="carousel-item relative w-full">
            <img
              src="https://img.daisyui.com/images/stock/photo-1414694762283-acccc27bca85.webp"
              class="w-full"
            >
            <div class="absolute left-5 right-5 top-1/2 flex -translate-y-1/2 transform justify-between">
              <a href="#slide2" class="btn btn-circle">❮</a>
              <a href="#slide4" class="btn btn-circle">❯</a>
            </div>
          </div>
          <div id="slide4" class="carousel-item relative w-full">
            <img
              src="https://img.daisyui.com/images/stock/photo-1665553365602-b2fb8e5d1707.webp"
              class="w-full"
            >
            <div class="absolute left-5 right-5 top-1/2 flex -translate-y-1/2 transform justify-between">
              <a href="#slide3" class="btn btn-circle">❮</a>
              <a href="#slide1" class="btn btn-circle">❯</a>
            </div>
          </div>
        </div>
        <NuxtLink to="/signin" class="btn btn-accent my-8">
          Sign in
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
