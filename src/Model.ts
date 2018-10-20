import * as Odin from ".";
import Base from "./Base";
import QueryBuilder from "./base/QueryBuilder";
import Relational from "./base/Relational";
import connections, { getConnection } from "./connections";
import * as DB from "./DB";
import events from "./events";
import GraphQL from "./GraphQL";
import GraphQLInstance from "./GraphQL/Model";
import * as Types from "./types";
import TypeAny from "./types/Any";
import * as utils from "./utils";

const EVENTS = ["created"];

interface Model<T = any> extends QueryBuilder<T>, Relational, GraphQLInstance<T> {
}

class Model<T = any> extends Base<T> implements QueryBuilder<T>, Relational, GraphQLInstance {
  public static DB = DB;
  public static GraphQL = GraphQL;
  public static Types = Types;
  public static connections = connections;

  public static connection: Odin.Connection = "default";

  public static table?: string;

  public static schema: Odin.Schema = {};

  public static timestamps: boolean = true;

  public static softDelete: boolean = false;

  public static CREATED_AT = "created_at";
  public static UPDATED_AT = "updated_at";
  public static DELETED_AT = "deleted_at";

  private static get _table() {
    return this.table || utils.makeTableName(this.name);
  }

  private static get _schema() {
    // TODO: id
    const schema: Odin.Schema = {
      id: this.Types.ObjectId,
      ...this.schema,
    };

    if (this.timestamps) {
      schema[this.CREATED_AT] = this.Types.Date.default(() => new Date());
      schema[this.UPDATED_AT] = this.Types.Date;
    }

    if (this.softDelete)
      schema[this.DELETED_AT] = this.Types.Date;

    return schema;
  }

  static get driver() {
    return getConnection(this.connection).driver;
  }

  public static on<T>(event: Odin.Event, listener: (item: Odin<T>) => void) {
    if (!utils.array.contains(EVENTS, event)) throw new TypeError(`Unexpected event "${event}"`);

    events.on(`${this.name}:${event}`, listener);

    return this;
  }

  public static toString() {
    return this._table;
  }

  public static validate<T = object>(document: T, updating: boolean = false) {
    const validator = (schema: Odin.Schema, doc: T) => {
      const value: { [key: string]: any } = {};
      let errors: { [key: string]: any } | null = {};

      for (const key in schema) {
        const type = schema[key];
        let item = (doc as { [key: string]: any })[key];

        if (type instanceof TypeAny) {
          // Type
          const validation = type.validate(item, updating);

          if (validation.value) value[key] = validation.value;

          if (validation.errors) errors[key] = validation.errors;
        } else {
          // Object
          if (!item) item = {};

          const validation = validator(type, item);

          if (validation.errors)
            for (const errorKey in validation.errors)
              errors[`${key}.${errorKey}`] = validation.errors[errorKey];

          if (utils.object.size(validation.value) > 0) value[key] = validation.value;
        }
      }

      if (utils.object.size(errors) === 0) errors = null;

      return {
        errors,
        value,
      };
    };

    const validation = validator(this._schema, document);

    if (validation.errors && updating) {
      utils.object.forEach(validation.errors, (errors, key) => {
        if (errors.length === 1 && errors[0] === "Must be provided")
          delete (validation.errors as any)[key];
      });

      if (utils.object.size(validation.errors) === 0) validation.errors = null;
    }

    if (validation.errors) throw validation.errors;

    const value = validation.value;

    if (updating && this.timestamps) value[this.UPDATED_AT] = new Date();

    return value;
  }

  private _isNew: boolean = false;

  public attributes: Odin.Document = {};

  constructor(document: Odin.Document = {}) {
    super();

    if (!document.id) this._isNew = true;

    this._setAttributes(document);
  }

  private _setAttributes(document: Odin.Document) {
    const schema = this.constructor._schema;
    const getters: string[] = [];
    const setters: string[] = [];

    for (const attr in schema) {
      const getterName = utils.getGetterName(attr);
      const getter = (this as any)[getterName] || ((origin: any) => origin);
      utils.define(this, "get", attr, () => getter(this.attributes[attr]));
      getters.push(getterName);

      const setterName = utils.getSetterName(attr);
      const setter = (this as any)[setterName] || ((origin: any) => origin);
      utils.define(this, "set", attr, value => this.attributes[attr] = setter(value));
      setters.push(setterName);
    }

    utils.object.forEach(document, (value, key) => {
      if (setters.indexOf(key as string) === -1) this.attributes[key] = value;
      else (this as any)[key] = value;
    });

    // virtual attributes
    Object.getOwnPropertyNames(this.constructor.prototype).forEach((key) => {
      if (getters.indexOf(key) !== -1) return;

      const regex = /^get([A-Z].*)Attribute$/.exec(key);

      if (!regex) return;

      utils.define(this, "get", utils.string.snakeCase(regex[1]), (this as any)[key]);
    });
  }

  /**
   * Gets the given attribute's value
   * @param {string} attribute
   * @returns {*}
   */
  public getAttribute(attribute: string) {
    return attribute.split(".").reduce((prev, curr) => prev[curr], this.attributes);
  }

  /**
   * Sets the given attribute's value
   * @param {string} attribute
   * @param {*} value
   */
  public setAttribute(attribute: string, value: any) {
    utils.object.set(this.attributes, attribute, value);
  }

  public toJSON() {
    return utils.object.mapValues(this.attributes, (value, attr) => {
      const getter = (this as any)[utils.getGetterName(attr as string)];

      return (getter ? getter(value) : value);
    });
  }

  public inspect() {
    return this.toJSON();
  }
}

export default Model;
