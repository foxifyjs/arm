import * as Odin from "..";
import * as DB from "../DB";
import Filter from "../DB/Filter";
import Join from "../DB/Join";
import { makeCollectionId } from "../utils";
import Relation from "./Base";
import HasMany from "./HasMany";

class EmbedMany<T extends Odin = any> extends HasMany<T> {
  constructor(
    model: Odin,
    relation: typeof Odin,
    localKey: string = `${makeCollectionId(relation.toString())}s`,
    foreignKey: string = "id",
    filter: undefined | ((q: Filter) => Filter),
    caller: (...args: any[]) => any
  ) {
    super(model, relation, localKey, foreignKey, filter, caller);
  }

  public load(query: DB<T> | Join<T>, relations: Relation.Relation[], filter?: (q: Filter) => Filter) {
    const relation = this.relation;
    const filters = [this.filter];

    if (filter) filters.push(filter);

    return query.join(
      relation.toString(),
      q => relations.reduce(
        (prev, cur) => {
          const subRelation = cur.name;

          if (!(relation as any)._relations.includes(subRelation))
            throw new Error(`Relation '${subRelation}' does not exist on '${relation.name}' Model`);

          const loader = relation.prototype[subRelation]();

          return loader.load(prev, cur.relations);
        },
        filters.reduce(
          (prev, filter) => filter(prev) as any,
          q.whereIn(this.foreignKey, `${this.model.constructor.toString()}.${this.localKey}`)
        )
      ),
      this.as
    );
  }

  public loadCount(query: DB<T> | Join<T>, relations: string[], filter?: (q: Filter) => Filter) {
    const relation = this.relation;
    const subRelation = relations.shift();

    if (subRelation) {
      if (!(relation as any)._relations.includes(subRelation))
        throw new Error(`Relation '${subRelation}' does not exist on '${relation.name}' Model`);

      return query
        .join(
          relation.toString(),
          q => relation.prototype[subRelation]().loadCount(
            this.filter(
              q
                .whereIn(this.foreignKey, `${this.model.constructor.toString()}.relation.${this.localKey}`)
                .aggregate({
                  $project: {
                    relation: "$$ROOT",
                  },
                })
            ) as any,
            relations,
            filter
          ),
          "relation"
        );
    }

    const filters = [this.filter];

    if (filter) filters.push(filter);

    return query
      .join(
        relation.toString(),
        q => filters.reduce(
          (prev, filter) => filter(prev) as any,
          q.whereIn(this.foreignKey, `${this.model.constructor.toString()}.relation.${this.localKey}`)
        ),
        "relation"
      );
  }
}

export default EmbedMany;
