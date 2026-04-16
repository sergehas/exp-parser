import winston from "winston";
import { logger } from "../services/utils/logger";
import { FeatureFamilyDTO, RankedFamily, Ranking, RankingDTO, RankingService } from "./ranking";

// file logger
const fileLogger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.printf(({ _level, message, _timestamp }) => {
      return `${message}`;
    })
  ),
  transports: [
    // - Write all logs with importance level of `info` or higher to `combined.log`
    //   (i.e., fatal, error, warn, and info, but not trace)
    //
    new winston.transports.File({ filename: "ranking.log" }),
  ],
});

const Diamond: RankingDTO = { id: 5, name: "Diamond" };
const Metal: RankingDTO = { id: 4, name: "Metal" };
const Platinum: RankingDTO = { id: 6, name: "Platinum", parent: Metal };
const Gold: RankingDTO = { id: 3, name: "Gold", parent: Metal };
const Silver: RankingDTO = { id: 2, name: "Silver", parent: Gold };
const Bronze: RankingDTO = { id: 1, name: "Bronze", parent: Silver };

const featureFamilies: FeatureFamilyDTO[] = [
  { name: "Family Bronze", ranking: Bronze },
  { name: "Family Bronze2", ranking: Bronze },
  { name: "Family Bronze3", ranking: Bronze },
  { name: "Family Bronze4", ranking: Bronze },
  { name: "Family Silver1", ranking: Silver },
  { name: "Family Silver2", ranking: Silver },
  { name: "Family Silver3", ranking: Silver },
  { name: "Family Gold1", ranking: Gold },
  { name: "Family Gold2", ranking: Gold },
  { name: "Family Gold3", ranking: Gold },
  { name: "Family Metal1", ranking: Metal },
];

function displayRankingTree<T extends Ranking>(rankings: T[], depth = 0): void {
  rankings.forEach((ranking) => {
    const indent = "  ".repeat(depth);
    fileLogger.info(`${indent}${ranking.name}`);
    if (ranking instanceof RankedFamily) {
      fileLogger.info(`${indent}  Families:`);
      ranking.families.forEach((family) => {
        fileLogger.info(`${indent}   - ${family}`);
      });
    }
    if (ranking.children && ranking.children.size > 0) {
      displayRankingTree(Array.from(ranking.children), depth + 1);
    }
  });
}

describe("rankingService", () => {
  let rankingService: RankingService;

  beforeEach(() => {
    rankingService = new RankingService();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("should build a ranking tree", () => {
    const r = rankingService.buildRankingTree([Bronze, Silver, Gold, Metal, Platinum, Diamond]);
    logger.info(`test buildRankingTree ${JSON.stringify(r)}`);
    fileLogger.info("# build a ranking tree-----------------------------------------------");
    displayRankingTree(r);
    expect(r.length).toBe(2);
    const rootNames = r.map((ranking) => ranking.name).sort((a, b) => a.localeCompare(b));
    expect(rootNames).toEqual(["Diamond", "Metal"]);

    for (const ranking of r) {
      if (ranking.name === "Metal") {
        expect(ranking.children.size).toBe(2);
        const childNames = Array.from(ranking.children).map((child) => child.name);
        expect(childNames).toContain("Gold");
        expect(childNames).toContain("Platinum");
      } else {
        expect(ranking.children.size).toBe(0);
      }
    }
  });

  it("should return a populated ranked family", () => {
    const r = rankingService.buildRankingTree([Bronze, Silver, Gold, Metal, Diamond, Platinum]);
    const ranked = r.map((ranking) => {
      const f = rankingService.buildRankedFamily(ranking, featureFamilies);
      logger.info(`test buildRankedFamily ${JSON.stringify(f)}`);
      return f;
    });
    expect(ranked.length).toBe(2);

    fileLogger.info("# build a ranked family----------------------------------------------");
    displayRankingTree(ranked);
  });
});

function generateLargeRankingCollection(size = 1000): RankingDTO[] {
  const rankings: RankingDTO[] = [];

  // Create the initial rankings without parents
  for (let i = 0; i < size; i++) {
    rankings.push({ id: i, name: `Ranking_${i}:` });
  }

  // Assign random parents to all rankings after the 10 first. ensure to have at least 10 root rankings
  for (let i = 10; i < size; i++) {
    const randomIndex = Math.floor(Math.random() * i);
    rankings[i].parent = rankings[randomIndex];
  }

  return rankings;
}

function generateLargeFeatureFamilyCollection(
  rankings: RankingDTO[],
  size = 5000
): FeatureFamilyDTO[] {
  const featureFamilies: FeatureFamilyDTO[] = [];

  for (let i = 0; i < size; i++) {
    const randomRankingIndex = Math.floor(Math.random() * rankings.length);
    featureFamilies.push({
      name: `Family_${i}`,
      ranking: rankings[randomRankingIndex],
    });
  }

  return featureFamilies;
}

describe("rankingService load test", () => {
  jest.setTimeout(15000);

  let rankingService: RankingService;

  beforeEach(() => {
    rankingService = new RankingService();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("should handle a large collection of 1000 rankings", () => {
    logger.info("Starting test for large collection of rankings");
    const largeRankingCollection = generateLargeRankingCollection(1000);
    expect(largeRankingCollection.length).toBe(1000);
    largeRankingCollection.slice(10).forEach((ranking) => {
      expect(ranking.parent).toBeDefined();
    });
    const rankingTree = rankingService.buildRankingTree(largeRankingCollection);
    expect(rankingTree.length).toBe(10); //10 root rankings
    fileLogger.info("# build a large collection of 1000 rankings--------------------------");
    displayRankingTree(rankingTree);
  });

  it("should handle a large collection of 5000 feature families", () => {
    const rankingSize = 1000;
    const featureFamilySize = 5000;
    const largeRankingCollection = generateLargeRankingCollection(rankingSize);
    const largeFeatureFamilyCollection = generateLargeFeatureFamilyCollection(
      largeRankingCollection,
      featureFamilySize
    );
    expect(largeFeatureFamilyCollection.length).toBe(featureFamilySize);
    largeFeatureFamilyCollection.forEach((featureFamily) => {
      expect(featureFamily.ranking).toBeDefined();
    });

    const rankingTree = rankingService.buildRankingTree(largeRankingCollection);

    const ranked = rankingTree.map((ranking) => {
      return rankingService.buildRankedFamily(ranking, largeFeatureFamilyCollection);
    });
    fileLogger.info(
      "# build a large collection of 5000 feature families--------------------------"
    );
    displayRankingTree(ranked);
  });
});
