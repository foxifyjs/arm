import Query from "../../../base/Query";
import { HasOne as Base } from "../../Relation";
import Driver from "../Driver";

class HasOne<T extends object = {}> extends Base {
  public load(query: Query<T>) {
    const as = this.as;

    return query.join(
      this.relation,
      q => q.where(this.foreignKey, `${this.model.constructor.toString()}.${this.localKey}`),
      as
    ).driver((q: Driver<T>) => q.pipeline({
      $unwind: { path: `$${as}`, preserveNullAndEmptyArrays: true },
    }));
  }
}

export default HasOne;
