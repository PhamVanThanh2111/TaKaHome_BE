import 'reflect-metadata';
import * as dotenv from 'dotenv';
dotenv.config();

import { DataSource } from 'typeorm';
import databaseConfig, {
  toTypeOrmOptions,
} from '../../../config/database.config';

// Lấy object config thô từ registerAs:
const getOptions = async () => {
  const cfg = await databaseConfig(); // <-- gọi hàm của registerAs
  return toTypeOrmOptions(cfg);
};

const getAppDataSource = async () => {
  const options = await getOptions();
  return new DataSource(options);
};

const AppDataSourcePromise = getAppDataSource();
export default AppDataSourcePromise;

export { AppDataSourcePromise as AppDataSource };
