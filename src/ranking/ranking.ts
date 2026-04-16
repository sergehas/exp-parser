import { logger } from "../services/utils/logger";

/**
 * Data Transfer Object for Ranking.
 * Represents a ranking with optional parent.
 * It is a chained list (chain to parent)
 */
export class RankingDTO {
  /** Unique identifier for the ranking */
  id!: number;
  /** Name of the ranking */
  name!: string;
  /** Optional parent ranking */
  parent?: RankingDTO; //parent ranking
}

/**
 * Tree node representing a ranking, with an ID, name, child rankings, and root status.
 * Used to build ranking hierarchies.
 */
export class Ranking {
  /** Unique identifier for the ranking */
  id!: number;
  /** Name of the ranking */
  name!: string;
  /** Set of child rankings */
  children = new Set<Ranking>(); //child rankings
  /** Indicates if this ranking is a root (has no parent) */
  isRoot = true; //has parent ranking

  /**
   * Creates a new Ranking instance.
   * @param id Unique identifier
   * @param name Ranking name
   */
  constructor(id: number, name: string) {
    this.id = id;
    this.name = name;
  }
}

/**
 * Data Transfer Object for Feature Family.
 * Represents a feature family with a name and associated rankingDTO.
 * Used to link features to rankings.
 **/
export class FeatureFamilyDTO {
  /** Name of the feature family */
  name!: string;
  /** Associated ranking */
  ranking!: RankingDTO;

  /**
   * Creates a new FeatureFamilyDTO instance.
   * @param name Feature family name
   * @param ranking Associated ranking
   */
  constructor(name: string, ranking: Ranking) {
    this.name = name;
    this.ranking = ranking;
  }
}

/**
 * Class representing a ranked family, which extends Ranking to include associated feature family names.
 * Used for ranked feature grouping (as a tree)
 */
export class RankedFamily extends Ranking {
  /** List of feature family names associated with this ranking */
  families!: string[];
}

/**
 * Service class providing methods to build ranked family trees and ranking hierarchies from DTOs and feature families.
 */
export class RankingService {
  /**
   * Builds a RankedFamily tree for a given ranking and feature families.
   * @param ranking The ranking to build from
   * @param featureFamilies List of feature families
   * @returns RankedFamily instance with children
   */
  buildRankedFamily(ranking: Ranking, featureFamilies: FeatureFamilyDTO[]): RankedFamily {
    const rankedFamily = new RankedFamily(ranking.id, ranking.name);
    rankedFamily.families = featureFamilies
      .filter((f) => f.ranking.id === ranking.id)
      .map((f) => f.name);
    ranking.children.forEach((child) => {
      const childRankedFamily = this.buildRankedFamily(child, featureFamilies);
      rankedFamily.children.add(childRankedFamily);
    });
    return rankedFamily;
  }

  /**
   * Builds a ranking tree from a list of RankingDTO objects.
   * @param rankingDTOs Array of RankingDTO
   * @returns Array of root Ranking instances
   */
  buildRankingTree(rankingDTOs: RankingDTO[]): Ranking[] {
    const rankingMap = new Map<number, Ranking>();

    for (const rankingDTO of rankingDTOs) {
      const ranking = new Ranking(rankingDTO.id, rankingDTO.name);
      rankingMap.set(rankingDTO.id, ranking);
      let currentParent = rankingDTO.parent;

      while (currentParent !== undefined) {
        ranking.isRoot = false;
        currentParent = currentParent.parent;
      }
    }
    logger.debug(`rankingMap after first loop ${JSON.stringify(Array.from(rankingMap.values()))}`);
    for (const rankingDTO of rankingDTOs) {
      let currentParent = rankingDTO.parent;
      let currentDTO = rankingDTO;
      while (currentParent !== undefined) {
        const child = rankingMap.get(currentDTO.id);
        const parent = rankingMap.get(currentParent.id);
        if (!child || !parent) {
          throw new Error(
            `Missing ranking for DTO id ${currentDTO.id} or parent id ${currentParent.id}`
          );
        }
        logger.trace(`Adding ${child?.name} as child to ${parent?.name}`);
        parent?.children.add(child);
        logger.trace(
          `${parent?.name} children: ${JSON.stringify(Array.from(parent?.children || []).map((c) => c.name))}`
        );
        currentDTO = currentParent;
        currentParent = currentDTO.parent;
      }
    }
    return Array.from(rankingMap.values()).filter((ranking) => ranking.isRoot);
  }
}
