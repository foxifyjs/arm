import * as mongodb from "mongodb";
import { function as func } from "../../../utils";
import Driver from "../../Driver";
import { OPERATORS, prepareKey, prepareValue } from "../utils";

namespace Filter {
  export interface Filters<T = any> {
    $and?: Array<mongodb.FilterQuery<T>>;
    $or?: Array<mongodb.FilterQuery<T>>;
    [operator: string]: any;
  }
}

class Filter {
  protected _filters: Filter.Filters = {
    $and: [],
  };

  get filters() {
    const FILTERS = {
      ...this._filters,
    };

    if (FILTERS.$and && FILTERS.$and.length === 0) delete FILTERS.$and;
    else if (FILTERS.$or && FILTERS.$or.length === 0) delete FILTERS.$or;

    return FILTERS;
  }

  /********************************** Helpers *********************************/

  protected _push_filter(operator: "and" | "or", value: any) {
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

  protected _where(field: string, operator: string, value: any) {
    field = prepareKey(field);
    value = prepareValue(field, value);

    return this._push_filter("and", {
      [field]: {
        [`$${operator}`]: value,
      },
    });
  }

  protected _or_where(field: string, operator: string, value: any) {
    field = prepareKey(field);
    value = prepareValue(field, value);

    return this._push_filter("or", {
      [field]: {
        [`$${operator}`]: value,
      },
    });
  }

  /******************************* Where Clauses ******************************/

  public where(query: Driver.FilterQuery): this;
  public where(field: string, value: any): this;
  public where(field: string, operator: Driver.Operator, value: any): this;
  public where(field: string | Driver.FilterQuery, operator?: Driver.Operator | any, value?: any) {
    if (func.isFunction(field)) {
      const filter: Filter = field(new Filter()) as any;

      return this._push_filter("and", filter.filters);
    }

    if (value === undefined) {
      value = operator;
      operator = "=";
    }

    return this._where(field, OPERATORS[operator], value);
  }

  public orWhere(query: Driver.FilterQuery): this;
  public orWhere(field: string, value: any): this;
  public orWhere(field: string, operator: Driver.Operator, value: any): this;
  public orWhere(field: string | Driver.FilterQuery, operator?: Driver.Operator | any, value?: any) {
    if (func.isFunction(field)) {
      const filter: Filter = field(new Filter()) as any;

      return this._push_filter("or", filter.filters);
    }

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
}

export default Filter;
