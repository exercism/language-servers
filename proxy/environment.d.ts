declare global {
  namespace NodeJS {
    interface ProcessEnv {
      RUBY_LANGUAGE_SERVER_HOST: string
      RUBY_LANGUAGE_SERVER_PORT: string
    }
  }
}

export {}
