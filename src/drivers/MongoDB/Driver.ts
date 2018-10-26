import * as deasync from "deasync";
import * as mongodb from "mongodb";
import { connect, Query } from "../../connections";
import * as utils from "../../utils";
import Base from "../Driver";

const { ObjectId } = mongodb;

const isID = (id: string) => /(_id$|^id$)/.test(id);

const prepareKey = (id: string) => id === "id" ? "_id" : id;

const prepareValue = (field: string, value: any) => {
  if (!isID(field)) return value;

  if (Array.isArray(value)) return value.map(v => new ObjectId(v));

  if (!ObjectId.isValid(value)) return value;

  return new ObjectId(value);
};

const OPERATORS: { [operator: string]: string } = {
  "<": "lt",
  "<=": "lte",
  "=": "eq",
  "<>": "ne",
  ">=": "gte",
  ">": "gt",
};

module Driver {
  export interface Filters<T = any> {
    $and?: Array<mongodb.FilterQuery<T>>;
    $or?: Array<mongodb.FilterQuery<T>>;
    [operator: string]: any;
  }
}

interface Driver<T = any> extends Base<T> {
  /*********************************** Joins **********************************/

  /******************************* Where Clauses ******************************/

  /*************** Mapping, Ordering, Grouping, Limit & Offset ****************/

  /*********************************** Read ***********************************/

  exists(): Promise<boolean>;
  exists(callback: mongodb.MongoCallback<boolean>): void;

  count(): Promise<number>;
  count(callback: mongodb.MongoCallback<number>): void;

  get(fields?: string[]): Promise<T[]>;
  get(fields: string[], callback: mongodb.MongoCallback<T[]>): void;
  get(callback: mongodb.MongoCallback<T[]>): void;

  first(fields?: string[]): Promise<T>;
  first(fields: string[], callback: mongodb.MongoCallback<T>): void;
  first(callback: mongodb.MongoCallback<T>): void;

  value(field: string): Promise<any>;
  value(field: string, callback: mongodb.MongoCallback<any>): void;

  max(field: string): Promise<any>;
  max(field: string, callback: mongodb.MongoCallback<any>): void;

  min(field: string): Promise<any>;
  min(field: string, callback: mongodb.MongoCallback<any>): void;

  avg(field: string): Promise<any>;
  avg(field: string, callback: mongodb.MongoCallback<any>): void;

  /********************************** Inserts *********************************/

  insert(item: T | T[]): Promise<number>;
  insert(item: T | T[], callback: mongodb.MongoCallback<number>): void;

  insertGetId(item: T): Promise<mongodb.ObjectId>;
  insertGetId(item: T, callback: mongodb.MongoCallback<mongodb.ObjectId>): void;

  /********************************** Updates *********************************/

  update(update: T): Promise<number>;
  update(update: T, callback: mongodb.MongoCallback<number>): void;

  increment(field: string, count?: number): Promise<number>;
  increment(field: string, callback: mongodb.MongoCallback<number>): void;
  increment(field: string, count: number, callback: mongodb.MongoCallback<number>): void;

  /********************************** Deletes *********************************/

  delete(): Promise<number>;
  delete(callback: mongodb.MongoCallback<number>): void;
}

class Driver<T = any> extends Base<T> {
  public static connect(con: connect.Connection) {
    if (con.connection)
      return () => new this((con.connection as mongodb.MongoClient).db(con.database));

    const uri = `mongodb://${con.host || "127.0.0.1"}:${con.port || "27017"}/admin`;

    const server = <mongodb.MongoClient>deasync(mongodb.MongoClient.connect)(uri, {
      useNewUrlParser: true,
      auth: con.user && con.password ? {
        user: con.user,
        password: con.password,
      } : undefined,
    });

    return () => new this(server.db(con.database));
  }

  protected _table!: string;

  public readonly driver = "MongoDB";

  protected _query!: mongodb.Collection;

  protected _filters: Driver.Filters = {
    $and: [],
  };

  private _pipeline: object[] = [];

  private _mappers: Array<Base.Mapper<T>> = [];

  protected get _filter() {
    const filter = {
      ...this._filters,
    };

    if (filter.$and && filter.$and.length === 0) delete filter.$and;

    return filter;
  }

  constructor(query: Query) {
    super(query);

    this.map(this._prepareToRead);
  }

  private _prepareToRead = (document: any): any => {
    if (
      !document ||
      !(utils.object.isObject(document) || typeof document === "object") ||
      utils.date.isDate(document)
    ) return document;

    if (Array.isArray(document)) return document.map(this._prepareToRead);

    return utils.object.mapValues(
      utils.object.mapKeys(document, (value, key) => key === "_id" ? "id" : key),
      (value, key) => isID(key as string) ?
        value && value.toString() :
        this._prepareToRead(value)
    );
  }

  private _prepareToStore = (document: any): any => {
    if (
      !document ||
      !(utils.object.isObject(document) || typeof document === "object") ||
      utils.date.isDate(document)
    ) return document;

    if (Array.isArray(document)) return document.map(this._prepareToStore);

    return utils.object.mapValues(
      utils.object.mapKeys(document, (value, key) => key === "id" ? "_id" : key),
      (value, key) => isID(key as string) ?
        (
          ObjectId.isValid(value) ?
            new ObjectId(value) :
            this._prepareToStore(value)
        ) :
        this._prepareToStore(value)
    );
  }

  public table(table: string) {
    if (!(this._query as any).collection)
      throw new Error("Can't change table name in the middle of query");

    this._query = ((this._query as any) as mongodb.Db).collection(table);

    this._table = table;

    return this;
  }

  /*********************************** Extra **********************************/

  public pipeline(...objs: object[]) {
    this._pipeline.push(...objs);

    return this;
  }

  /*********************************** Joins **********************************/

  public join(
    table: string,
    query: Base.JoinQuery<T> = q => q.on(utils.makeTableId(table), `${table}.id`),
    as: string = table
  ) {
    const LET: { [key: string]: any } = {};
    const EXPR_MATCH: object[] = [];
    const MATCH: object[] = [];

    const QUERY = {
      on: (field: any, operator: any, value?: any) => {
        field = prepareKey(field);

        if (value === undefined) {
          value = operator;
          operator = "=";
        }

        if (utils.string.isString(value) && new RegExp(`^${this._table}\..+`).test(value)) {
          const keys = utils.array.tail(value.split("."));

          keys.push(prepareKey(keys.pop() as string));

          const key = keys.join(".");
          const pivotKey = `pivot_${key}`;

          LET[pivotKey] = `$${key}`;

          EXPR_MATCH.push({
            [`$${OPERATORS[operator]}`]: [`$${field}`, `$$${pivotKey}`],
          });

          return QUERY;
        }

        value = prepareValue(field, value);

        MATCH.push({
          [field]: {
            [`$${OPERATORS[operator]}`]: value,
          },
        });

        return QUERY;
      },
    };

    query(QUERY);

    const PIPELINE: object[] = [];

    if (EXPR_MATCH.length > 0) PIPELINE.push({
      $match: {
        $expr: {
          $and: EXPR_MATCH,
        },
      },
    });

    if (MATCH.length > 0) PIPELINE.push({
      $match: {
        $and: MATCH,
      },
    });

    return this.pipeline({
      $lookup: { as, from: table, let: LET, pipeline: PIPELINE },
    });
  }

  /******************************* Where Clauses ******************************/

  private _push_filter(operator: "and" | "or", value: any) {
    const filters = { ...this._filters };

    if (operator === "and" && filters.$or) {
      filters.$and = [this._filters];
      delete filters.$or;
    } else if (operator === "or" && filters.$and) {
      filters.$or = [this._filters];
      delete filters.$and;
    }

    filters[`$${operator}`].push(value);

    this._filters = filters;

    return this;
  }

  private _where(field: string, operator: string, value: any) {
    field = prepareKey(field);
    value = prepareValue(field, value);

    return this._push_filter("and", {
      [field]: {
        [`$${operator}`]: value,
      },
    });
  }

  private _or_where(field: string, operator: string, value: any) {
    field = prepareKey(field);
    value = prepareValue(field, value);

    return this._push_filter("or", {
      [field]: {
        [`$${operator}`]: value,
      },
    });
  }

  public where(field: string, operator: Base.Operator | any, value?: any) {
    if (value === undefined) {
      value = operator;
      operator = "=";
    }

    return this._where(field, OPERATORS[operator], value);
  }

  public orWhere(field: string, operator: Base.Operator | any, value?: any) {
    if (value === undefined) {
      value = operator;
      operator = "=";
    }

    return this._or_where(field, OPERATORS[operator], value);
  }

  public whereLike(field: string, value: any) {
    if (!(value instanceof RegExp)) value = new RegExp(value, "i");

    return this._where(field, "regex", value);
  }

  public whereNotLike(field: string, value: any) {
    if (!(value instanceof RegExp)) value = new RegExp(value, "i");

    return this._where(field, "not", value);
  }

  public whereIn(field: string, values: any[]) {
    return this._where(field, "in", values);
  }

  public whereNotIn(field: string, values: any[]) {
    return this._where(field, "nin", values);
  }

  public whereBetween(field: string, start: any, end: any) {
    return this._where(field, "gte", start)
      ._where(field, "lte", end);
  }

  public whereNotBetween(field: string, start: any, end: any) {
    return this._where(field, "lt", start)
      ._or_where(field, "gt", end);
  }

  public whereNull(field: string) {
    return this._where(field, "eq", null);
  }

  public whereNotNull(field: string) {
    return this._where(field, "ne", null);
  }

  /*************** Mapping, Ordering, Grouping, Limit & Offset ****************/

  public map(fn: Base.Mapper<T>) {
    this._mappers.push(fn);

    return this;
  }

  // groupBy(field: string, query?: Base.GroupQuery<T>) {
  //   const MATCH: { [key: string]: any } = {};

  //   this.pipeline({ $group: { _id: field } }, { $project: { [field]: "$_id" } });

  //   if (!query) return this;

  //   const QUERY = {
  //     having: (field: any, operator: any, value?: any) => {
  //       field = prepareKey(field);

  //       if (value === undefined) {
  //         value = operator;
  //         operator = "=";
  //       }

  //       MATCH[field] = {
  //         [`$${OPERATORS[operator]}`]: prepareValue(field, value),
  //       };

  //       return QUERY;
  //     },
  //   };

  //   query(QUERY);

  //   if (utils.object.isEmpty(MATCH)) return this;

  //   return this.pipeline({ $match: MATCH });
  // }

  public orderBy(field: string, order?: Base.Order) {
    return this.pipeline({ $sort: { [field]: order === "desc" ? -1 : 1 } });
  }

  public skip(offset: number) {
    return this.pipeline({ $skip: offset });
  }

  public limit(limit: number) {
    return this.pipeline({ $limit: limit });
  }

  /*********************************** Read ***********************************/

  private _aggregate(options?: mongodb.CollectionAggregationOptions) {
    // FIXME: the mongodb typing has a bug i think (aggregation mapping)
    return this._mappers.reduce(
      (query: any, mapper) => query.map(mapper),
      this._query.aggregate(
        [
          { $match: this._filter },
          ...this._pipeline,
        ],
        options
      )
    ) as mongodb.AggregationCursor;
  }

  public async exists(callback?: mongodb.MongoCallback<boolean>) {
    if (callback) return this.count((err, res) => callback(err, res !== 0));

    return (await this.count()) !== 0;
  }

  public count(callback?: mongodb.MongoCallback<number>): Promise<number> | void {
    return this._query.countDocuments(this._filter, callback as any);
  }

  public get(
    fields?: string[] | mongodb.MongoCallback<T[]>,
    callback?: mongodb.MongoCallback<T[]>
  ): Promise<T[]> | void {
    if (utils.function.isFunction(fields)) {
      callback = fields;
      fields = undefined;
    }

    if (fields) this.pipeline({
      $project: fields.reduce(
        (prev, cur) => (prev[prepareKey(cur)] = 1, prev),
        { _id: 0 } as { [key: string]: any }
      ),
    });

    return this._aggregate()
      .toArray(callback as any);
  }

  public async first(
    fields?: string[] | mongodb.MongoCallback<T>,
    callback?: mongodb.MongoCallback<T>
  ) {
    if (utils.function.isFunction(fields)) {
      callback = fields;
      fields = undefined;
    }

    this.limit(1);

    if (fields) this.pipeline({
      $project: fields.reduce(
        (prev, cur) => (prev[prepareKey(cur)] = 1, prev),
        { _id: 0 } as { [key: string]: any }
      ),
    });

    if (callback) return this._aggregate().toArray((err, res) => err
      ? (callback as mongodb.MongoCallback<T>)(err, res as any)
      : (callback as mongodb.MongoCallback<T>)(err, res[0]
      ));

    return (await this._aggregate().toArray())[0];
  }

  public value(field: string, callback?: mongodb.MongoCallback<any>) {
    field = prepareKey(field);

    const keys = field.split(".");

    return this.pipeline(
      {
        $project: {
          _id: 0,
          [field]: { $ifNull: [`$${field}`, "$__NULL__"] },
        },
      }
    ).map((item: any) => keys.reduce((prev, key) => prev[key], item))
      ._aggregate()
      .toArray(callback as any) as any;
  }

  public async max(field: string, callback?: mongodb.MongoCallback<any>) {
    const query = this.pipeline({ $group: { _id: null, max: { $max: `$${field}` } } })
      ._aggregate();

    if (callback)
      return query.toArray((err, res) => {
        if (err) return callback(err, res);

        callback(err, res[0].max);
      });

    return (await query.toArray())[0].max;
  }

  public async min(field: string, callback?: mongodb.MongoCallback<any>) {
    const query = this.pipeline({ $group: { _id: null, min: { $min: `$${field}` } } })
      ._aggregate();

    if (callback)
      return query.toArray((err, res) => {
        if (err) return callback(err, res);

        callback(err, res[0].min);
      });

    return (await query.toArray())[0].min;
  }

  public async avg(field: string, callback?: mongodb.MongoCallback<any>) {
    const query = this.pipeline({ $group: { _id: null, avg: { $avg: `$${field}` } } })
      ._aggregate();

    if (callback)
      return query.toArray((err, res) => {
        if (err) return callback(err, res);

        callback(err, res[0].avg);
      });

    return (await query.toArray())[0].avg;
  }

  /********************************** Inserts *********************************/

  public async insert(item: T | T[], callback?: mongodb.MongoCallback<number>) {
    item = this._prepareToStore(item);

    if (Array.isArray(item)) {
      if (callback)
        return this._query.insertMany(item, (err, res) => callback(err, res.insertedCount));

      return (await this._query.insertMany(item)).insertedCount;
    }

    if (callback)
      return this._query.insertOne(item, (err, res) => callback(err, res.insertedCount));

    return (await this._query.insertOne(item)).insertedCount;
  }

  public async insertGetId(item: T, callback?: mongodb.MongoCallback<mongodb.ObjectId>) {
    item = this._prepareToStore(item);

    if (callback)
      return this._query.insertOne(item, (err, res) => callback(err, res.insertedId));

    return (await this._query.insertOne(item)).insertedId;
  }

  /********************************** Updates *********************************/

  private async _update(
    update: object,
    callback?: mongodb.MongoCallback<mongodb.UpdateWriteOpResult>
  ): Promise<mongodb.UpdateWriteOpResult> {
    if (callback)
      return this._query.updateMany(this._filter, update, callback) as any;

    return await this._query.updateMany(this._filter, update);
  }

  public async update(update: T, callback?: mongodb.MongoCallback<number>) {
    const _update = {
      $set: this._prepareToStore(update),
    };

    if (callback)
      return this._update(_update, (err, res) => callback(err, res.modifiedCount));

    return (await this._update(_update)).modifiedCount;
  }

  public async increment(
    field: string,
    count?: number | mongodb.MongoCallback<number>,
    callback?: mongodb.MongoCallback<number>
  ) {
    if (count === undefined) count = 1;
    else if (utils.function.isFunction(count)) {
      callback = count;
      count = 1;
    }

    const update = {
      $inc: {
        [field]: count,
      },
    };

    if (callback)
      return this._update(update, (err, res) => (callback as any)(err, res.modifiedCount));

    return (await this._update(update)).modifiedCount;
  }

  /********************************** Deletes *********************************/

  public async delete(callback?: mongodb.MongoCallback<number>) {
    if (callback)
      return this._query.deleteMany(
        this._filter,
        (err, res: any) => callback(err, res.deletedCount)
      );

    return (await this._query.deleteMany(this._filter)).deletedCount;
  }
}

export default Driver;
