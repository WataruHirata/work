import "server-only";
import mysql, { type Pool, type PoolConnection, type ResultSetHeader, type RowDataPacket } from "mysql2/promise";

const globals = globalThis as typeof globalThis & { __minoriyaMysqlPool?: Pool };

export function mysqlPool(): Pool {
  if (globals.__minoriyaMysqlPool) return globals.__minoriyaMysqlPool;
  const host = process.env.MYSQL_HOST || "127.0.0.1";
  const database = process.env.MYSQL_DATABASE || "minoriya_starter";
  const user = process.env.MYSQL_USER || "root";
  if (!host || !database || !user) throw new Error("MYSQL_HOST、MYSQL_DATABASE、MYSQL_USERを設定してください。");
  globals.__minoriyaMysqlPool = mysql.createPool({
    host,
    port: Number(process.env.MYSQL_PORT || 3306),
    database,
    user,
    password: process.env.MYSQL_PASSWORD || "P@ssw0rd",
    connectionLimit: 10,
    waitForConnections: true,
    queueLimit: 50,
    charset: "utf8mb4",
    timezone: "+09:00",
    supportBigNumbers: true,
    bigNumberStrings: false,
    dateStrings: false,
  });
  return globals.__minoriyaMysqlPool;
}

export async function mysqlTransaction<T>(run: (connection: PoolConnection) => Promise<T>): Promise<T> {
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

export async function mysqlRows<T extends RowDataPacket>(sql: string, params: unknown[] = []): Promise<T[]> {
  const [rows] = await mysqlPool().execute<T[]>(sql, params as never[]);
  return rows;
}

export type MysqlResult = ResultSetHeader;
