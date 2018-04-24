import * as mongodb from "mongodb";
import * as connections from "../connections";

module Driver {
  export type Callback<T = any> = (error: Error, result: T) => void;

  export type Operator = "<" | "<=" | "=" | "<>" | ">=" | ">" | "like";

  export type Order = "asc" | "desc";

  export type Id = string | number | mongodb.ObjectId;
}

abstract class Driver<T = any> {
  protected _query: any;

  abstract get driver(): connections.Driver;

  constructor(query: connections.Query) {
    this._query = query;
  }

  abstract table(table: string): this;

  /******************************* Where Clauses ******************************/

  // TODO where query

  abstract where(field: string, value: any): this;
  abstract where(field: string, operator: Driver.Operator, value: any): this;

  abstract orWhere(field: string, value: any): this;
  abstract orWhere(field: string, operator: Driver.Operator, value: any): this;

  abstract whereIn(field: string, values: any[]): this;

  abstract whereNotIn(field: string, values: any[]): this;

  abstract whereBetween(field: string, start: any, end: any): this;

  abstract whereNotBetween(field: string, start: any, end: any): this;

  abstract whereNull(field: string): this;

  abstract whereNotNull(field: string): this;

  /******************** Ordering, Grouping, Limit & Offset ********************/

  // TODO groupBy
  // abstract groupBy(field: string): this;

  abstract orderBy(field: string, order?: Driver.Order): this;

  abstract skip(offset: number): this;

  abstract limit(limit: number): this;

  /*********************************** Read ***********************************/

  abstract exists(): Promise<boolean>;
  abstract exists(callback: Driver.Callback<boolean>): void;

  abstract count(): Promise<number>;
  abstract count(callback: Driver.Callback<number>): void;

  abstract get(fields?: string[]): Promise<T[]>;
  abstract get(fields: string[], callback: Driver.Callback<T[]>): void;
  abstract get(callback: Driver.Callback<T[]>): void;

  abstract first(fields?: string[]): Promise<T>;
  abstract first(fields: string[], callback: Driver.Callback<T>): void;
  abstract first(callback: Driver.Callback<T>): void;

  abstract value(field: string): Promise<any>;
  abstract value(field: string, callback: Driver.Callback<any>): void;

  abstract max(field: string): Promise<any>;
  abstract max(field: string, callback: Driver.Callback<any>): void;

  abstract min(field: string): Promise<any>;
  abstract min(field: string, callback: Driver.Callback<any>): void;

  abstract avg(field: string): Promise<any>;
  abstract avg(field: string, callback: Driver.Callback<any>): void;

  /********************************** Inserts *********************************/

  abstract insert(item: T | T[]): Promise<number>;
  abstract insert(item: T | T[], callback: Driver.Callback<number>): void;

  abstract insertGetId(item: T): Promise<Driver.Id>;
  abstract insertGetId(item: T, callback: Driver.Callback<Driver.Id>): void;

  abstract create(item: T): Promise<T>;
  abstract create(item: T, callback: Driver.Callback<T>): void;

  /********************************** Updates *********************************/

  abstract update(update: T): Promise<number>;
  abstract update(update: T, callback: Driver.Callback<number>): void;

  abstract increment(field: string, count?: number): Promise<number>;
  abstract increment(field: string, callback: Driver.Callback<number>): void;
  abstract increment(field: string, count: number, callback: Driver.Callback<number>): void;

  /********************************** Deletes *********************************/

  abstract delete(): Promise<number>;
  abstract delete(callback: Driver.Callback<number>): void;
}

export default Driver;
