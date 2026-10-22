import "server-only";
import mysql, {
  type Pool,
  type PoolConnection,
  type ResultSetHeader,
  type RowDataPacket,
} from "mysql2/promise";
import { mysqlConnectionConfig } from "./config";

const globals = globalThis as typeof globalThis & { __minoriyaMysqlPool?: Pool };

export function mysqlPool(): Pool {
  if (globals.__minoriyaMysqlPool) return globals.__minoriyaMysqlPool;
  const connection = mysqlConnectionConfig();
  globals.__minoriyaMysqlPool = mysql.createPool({
    ...connection,
    connectionLimit: 10,
    waitForConnections: true,
    queueLimit: 50,
    supportBigNumbers: true,
    bigNumberStrings: false,
    dateStrings: false,
  });
  return globals.__minoriyaMysqlPool;
}

export async function mysqlTransaction<T>(
  run: (connection: PoolConnection) => Promise<T>,
): Promise<T> {
  const connection = await mysqlPool().getConnection();
  try {
    await connection.beginTransaction();
    const result = await run(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function mysqlRows<T extends RowDataPacket>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const [rows] = await mysqlPool().execute<T[]>(sql, params as never[]);
  return rows;
}

export type MysqlResult = ResultSetHeader;
