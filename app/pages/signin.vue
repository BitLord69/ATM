<template>
  <div class="flex flex-col gap-6 max-w-sm mx-auto mt-20">
    <!-- Email -->
    <AuthButton provider="email" icon="tabler:mail">
      Sign in with Email
    </AuthButton>

    <!-- GitHub -->
    <AuthButton provider="github" icon="tabler:brand-github">
      Sign in with GitHub
    </AuthButton>

    <!-- Google -->
    <AuthButton provider="google" icon="tabler:brand-google-filled">
      Sign in with Google
    </AuthButton>

    <!-- Facebook -->
    <AuthButton provider="facebook" icon="tabler:brand-facebook-filled">
      Sign in with Facebook
    </AuthButton>
  </div>
</template>
