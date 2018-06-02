import TypeAny from "./Any";
import { array, number } from "../utils";

interface TypeArray {
  ofType: TypeAny;
}

class TypeArray extends TypeAny {
  protected _type = "Array";

  protected _base(v: any): string | null {
    if (Array.isArray(v)) return null;

    return "Must be an array";
  }

  of(type: TypeAny) {
    if (!(type instanceof TypeAny))
      throw new TypeError(`Expected 'type' to be a 'TypeAny' instance, got '${typeof type}' insted`);

    this.ofType = type;

    return this._test(
      (v: any[]) => array.first(array.deepFlatten(array.compact(v.map((item) => type.validate(item).errors)))),
    )
      ._cast((v: any[]) => v.map((item) => type.validate(item).value));
  }

  min(n: number) {
    if (!number.isNumber(n)) throw new TypeError("'n' must be a number");

    if (n < 0) throw new TypeError("'n' must be a positive number");

    return this._test((v: any[]) => v.length < n ? `Must be at least ${n} items` : null);
  }

  max(n: number) {
    if (!number.isNumber(n)) throw new TypeError("'n' must be a number");

    if (n < 0) throw new TypeError("'n' must be a positive number");

    return this._test((v: any[]) => v.length > n ? `Must be at most ${n} items` : null);
  }

  length(n: number) {
    if (!number.isNumber(n)) throw new TypeError("'n' must be a number");

    if (n < 0) throw new TypeError("'n' must be a positive number");

    return this._test((v: any[]) => v.length !== n ? `Must be exactly ${n} items` : null);
  }
}

export default TypeArray;
