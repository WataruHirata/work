import { describe, expect, it } from "vitest";
import { mysqlConnectionConfig, mysqlConnectionConfigured } from "@database/mysql/config";

const required = {
  MYSQL_HOST: "127.0.0.1",
  MYSQL_DATABASE: "minoriya_test",
  MYSQL_USER: "minoriya_app",
};

describe("MySQL connection settings", () => {
  it("builds the server-only connection settings with safe defaults", () => {
    expect(mysqlConnectionConfig(required)).toEqual({
      host: "127.0.0.1",
      port: 3306,
      database: "minoriya_test",
      user: "minoriya_app",
      password: "",
      charset: "utf8mb4",
      timezone: "+09:00",
    });
    expect(mysqlConnectionConfigured(required)).toBe(true);
  });

  it("rejects missing required settings and invalid ports before opening a connection", () => {
    expect(() => mysqlConnectionConfig({ MYSQL_HOST: "127.0.0.1" })).toThrow(
      "MYSQL_DATABASE、MYSQL_USER",
    );
    expect(() => mysqlConnectionConfig({ ...required, MYSQL_PORT: "not-a-port" })).toThrow(
      "MYSQL_PORT",
    );
    expect(() => mysqlConnectionConfig({ ...required, MYSQL_PORT: "65536" })).toThrow("MYSQL_PORT");
  });
});
