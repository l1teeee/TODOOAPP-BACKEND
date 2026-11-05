import type { AppConfig } from "../config/env.js";
import type { HttpServer } from "../http/http-server.js";

export interface ModuleContext {
  readonly config: AppConfig;
}
export interface AppModule {
  readonly name: string;
  register(server: HttpServer, context: ModuleContext): Promise<void>;
}
