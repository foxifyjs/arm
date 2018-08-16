import * as mongodb from "mongodb";
import * as drivers from "./drivers";
import * as utils from "./utils";

const CONNECTIONS_GLOBAL = Symbol("__FOXIFY_ODIN__");

if (!(global as any)[CONNECTIONS_GLOBAL]) (global as any)[CONNECTIONS_GLOBAL] = {};

const setConnection = (name: string, connection: Connection) => (global as any)[CONNECTIONS_GLOBAL][name] = connection;

const connect = (connection: connect.Connection) => {
  switch (connection.driver) {
    case "MongoDB":
      return drivers.MongoDB.Driver.connect(connection);
    default:
      throw new Error("Unknown database driver");
  }
};

export type Driver = "MongoDB";
export type Query = mongodb.Db;

export type Connection = <T = any, D extends drivers.Base<T> = drivers.Base<T>>() => D;

export namespace connect {
  export interface Connection {
    driver: Driver;
    database: string;
    connection?: mongodb.MongoClient;
    user?: string;
    password?: string;
    host?: string;
    port?: string;
  }

  export interface Connections {
    [name: string]: connect.Connection;
  }
}

export const getConnection = <T = any, D extends drivers.Base<T> = drivers.Base<T>>(name: string): D =>
  (global as any)[CONNECTIONS_GLOBAL][name]();

export default (connections: connect.Connections) => {
  utils.object.forEach(connections, (connection: connect.Connection, name) => {
    if (!(global as any)[CONNECTIONS_GLOBAL][name])
      setConnection(name as string, connect(connection) as any);
  });
};
