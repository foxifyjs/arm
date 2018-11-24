import * as Base from "graphql";
import * as Odin from "..";

module GraphQL {
  export interface Queries {
    [query: string]: any;
  }
}

type GraphQL = (...models: Array<typeof Odin>) => Base.GraphQLSchema;

const GraphQL: GraphQL = (...models) => {
  const queries: GraphQL.Queries = {};
  const mutations: GraphQL.Queries = {};

  models.forEach((Odin) => {
    const gql = Odin.toGraphQL();

    Object.assign(queries, gql.queries);

    Object.assign(mutations, gql.mutations);
  });

  return new Base.GraphQLSchema({
    query: new Base.GraphQLObjectType({
      name: "Query",
      fields: queries,
    }),
    mutation: new Base.GraphQLObjectType({
      name: "Mutation",
      fields: mutations,
    }),
  });
};

export default GraphQL;
