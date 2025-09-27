import { registerAs } from '@nestjs/config';
import { DataSourceOptions } from 'typeorm';

export type DatabaseConfig = {
  type: 'postgres';
  url?: string;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  database?: string;
  ssl?: boolean;
};

export default registerAs<DatabaseConfig>('database', () => {
  const useUrl = !!process.env.DB_URL;
  const ssl = (process.env.DB_SSL ?? 'true').toLowerCase() === 'true';

  return {
    type: process.env.DB_TYPE as 'postgres',
    ...(useUrl
      ? { url: process.env.DB_URL }
      : {
          host: process.env.DB_HOST,
          port: +(process.env.DB_PORT ?? 5432),
          username: process.env.DB_USER ?? 'neondb_owner',
          password: process.env.DB_PASSWORD,
          database: process.env.DB_NAME ?? 'rent_home',
        }),
    ssl,
  };
});

/**
 * Convert DatabaseConfig => TypeORM DataSourceOptions
 */
export function toTypeOrmOptions(cfg: DatabaseConfig): DataSourceOptions {
  const common: Partial<DataSourceOptions> = {
    type: cfg.type,
    entities: ['dist/**/*.entity{.ts,.js}'], // khi chạy app đã build
    migrations: ['dist/migrations/*.js'], // khi chạy app đã build
    synchronize: false, // OFF for production
    ssl: cfg.ssl ? { rejectUnauthorized: false } : undefined,
  };

  if (cfg.url) {
    return { ...common, url: cfg.url } as DataSourceOptions;
  }
  return {
    ...common,
    host: cfg.host,
    port: cfg.port,
    username: cfg.username,
    password: String(cfg.password ?? ''),
    database: cfg.database,
  } as DataSourceOptions;
}
