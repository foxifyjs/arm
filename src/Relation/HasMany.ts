import * as Odin from "..";
import DB from "../DB";
import Filter from "../DB/Filter";
import Join from "../DB/Join";
import { makeCollectionId } from "../utils";
import Relation from "./Base";

class HasMany<T extends Odin = Odin> extends Relation<T> {
  constructor(
    model: Odin,
    relation: typeof Odin,
    localKey = "id",
    foreignKey: string = makeCollectionId(model.constructor.toString()),
    filter: undefined | ((q: Filter) => Filter),
    caller: (...args: any[]) => any,
  ) {
    super(model, relation, localKey, foreignKey, filter, caller);
  }

  public load(
    query: DB<T> | Join<T>,
    relations: Relation.Relation[],
    withTrashed?: boolean,
    filter?: (q: Filter) => Filter,
  ) {
    const relation = this.relation;
    const filters: Array<(q: Filter) => Filter> = [];

    if (relation.softDelete && !withTrashed)
      filters.push((q) => q.whereNull(relation.DELETED_AT));

    filters.push(this.filter);

    if (filter) filters.push(filter);

    return query.join(
      relation.toString(),
      (q) =>
        relations.reduce(
          (prev, cur) => {
            const subRelation = cur.name;

            if (!(relation as any)._relations.includes(subRelation))
              throw new Error(
                `Relation '${subRelation}' does not exist on '${relation.name}' Model`,
              );

            const loader: Relation = relation.prototype[subRelation]();

            return loader.load(prev, cur.relations, withTrashed) as any;
          },
          filters.reduce(
            (prev, filter) => filter(prev) as any,
            q.where(
              this.foreignKey,
              `${this.model.constructor.toString()}.${this.localKey}`,
            ),
          ),
        ),
      this.as,
    );
  }

  public loadCount(
    query: DB<T> | Join<T>,
    relations: string[],
    withTrashed?: boolean,
    filter?: (q: Filter) => Filter,
  ) {
    const relation = this.relation;
    const subRelation = relations.shift();
    const filters: Array<(q: Filter) => Filter> = [];

    if (relation.softDelete && !withTrashed)
      filters.push((q) => q.whereNull(relation.DELETED_AT));

    filters.push(this.filter);

    if (subRelation) {
      if (!(relation as any)._relations.includes(subRelation))
        throw new Error(
          `Relation '${subRelation}' does not exist on '${relation.name}' Model`,
        );

      return query.join(
        relation.toString(),
        (q) =>
          relation.prototype[subRelation]().loadCount(
            filters.reduce(
              (prev, filter) => filter(prev) as any,
              q
                .where(
                  this.foreignKey,
                  `${this.model.constructor.toString()}.relation.${
                    this.localKey
                  }`,
                )
                .aggregate({
                  $project: {
                    relation: "$$ROOT",
                  },
                }),
            ),
            relations,
            withTrashed,
            filter,
          ),
        "relation",
      );
    }

    if (filter) filters.push(filter);

    return query.join(
      relation.toString(),
      (q) =>
        filters.reduce(
          (prev, filter) => filter(prev) as any,
          q.where(
            this.foreignKey,
            `${this.model.constructor.toString()}.relation.${this.localKey}`,
          ),
        ),
      "relation",
    );
  }
}

export default HasMany;
