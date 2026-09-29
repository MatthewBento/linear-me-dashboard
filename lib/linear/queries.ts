import type {
  BoardCache,
  BoardFacets,
  LinearCycle,
  LinearIssue,
  LinearLabel,
  LinearProject,
  LinearState,
  LinearTeam,
  LinearViewer,
} from "@/lib/types";
import { linearGraphql } from "./client";

const VIEWER_AND_ISSUES = /* GraphQL */ `
  query MeIssues($after: String, $assigneeId: ID) {
    viewer {
      id
      name
      displayName
      email
      organization {
        id
        name
        urlKey
      }
    }
    issues(
      first: 100
      after: $after
      filter: {
        assignee: {
          id: { eq: $assigneeId }
        }
      }
    ) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        identifier
        title
        url
        priority
        priorityLabel
        dueDate
        estimate
        updatedAt
        createdAt
        completedAt
        state {
          id
          name
          type
          color
        }
        team {
          id
          name
          key
        }
        project {
          id
          name
        }
        cycle {
          id
          name
          number
          startsAt
          endsAt
          completedAt
        }
        labels {
          nodes {
            id
            name
            color
          }
        }
        blockedBy {
          nodes {
            id
            identifier
            title
          }
        }
      }
    }
  }
`;

const VIEWER_ISSUES_IS_ME = /* GraphQL */ `
  query MeIssuesIsMe($after: String) {
    viewer {
      id
      name
      displayName
      email
      organization {
        id
        name
        urlKey
      }
    }
    issues(
      first: 100
      after: $after
      filter: { assignee: { isMe: { eq: true } } }
    ) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        identifier
        title
        url
        priority
        priorityLabel
        dueDate
        estimate
        updatedAt
        createdAt
        completedAt
        state {
          id
          name
          type
          color
        }
        team {
          id
          name
          key
        }
        project {
          id
          name
        }
        cycle {
          id
          name
          number
          startsAt
          endsAt
          completedAt
        }
        labels {
          nodes {
            id
            name
            color
          }
        }
        blockedBy {
          nodes {
            id
            identifier
            title
          }
        }
      }
    }
  }
`;

type GqlIssueNode = {
  id: string;
  identifier: string;
  title: string;
  url: string;
  priority: number;
  priorityLabel: string;
  dueDate: string | null;
  estimate: number | null;
  updatedAt: string;
  createdAt: string;
  completedAt: string | null;
  state: LinearState;
  team: LinearTeam | null;
  project: LinearProject | null;
  cycle: LinearCycle | null;
  labels: { nodes: LinearLabel[] };
  blockedBy: { nodes: { id: string; identifier: string; title: string }[] };
};

type GqlPage = {
  viewer: LinearViewer;
  issues: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    nodes: GqlIssueNode[];
  };
};

function mapIssue(node: GqlIssueNode): LinearIssue {
  return {
    id: node.id,
    identifier: node.identifier,
    title: node.title,
    url: node.url,
    priority: node.priority,
    priorityLabel: node.priorityLabel,
    dueDate: node.dueDate,
    estimate: node.estimate,
    updatedAt: node.updatedAt,
    createdAt: node.createdAt,
    completedAt: node.completedAt,
    state: node.state,
    team: node.team,
    project: node.project,
    cycle: node.cycle,
    labels: node.labels?.nodes ?? [],
    blockedBy: node.blockedBy?.nodes ?? [],
  };
}

function uniqById<T extends { id: string }>(items: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of items) map.set(item.id, item);
  return [...map.values()].sort((a, b) =>
    ("name" in a && "name" in b
      ? String((a as { name: string }).name).localeCompare(
          String((b as { name: string }).name),
        )
      : a.id.localeCompare(b.id)),
  );
}

function buildFacets(issues: LinearIssue[]): BoardFacets {
  return {
    states: uniqById(issues.map((i) => i.state)),
    projects: uniqById(issues.map((i) => i.project).filter(Boolean) as LinearProject[]),
    teams: uniqById(issues.map((i) => i.team).filter(Boolean) as LinearTeam[]),
    labels: uniqById(issues.flatMap((i) => i.labels)),
    cycles: uniqById(issues.map((i) => i.cycle).filter(Boolean) as LinearCycle[]),
  };
}

export async function syncMyIssues(
  apiKey: string,
  userIdOverride?: string,
): Promise<BoardCache> {
  const issues: LinearIssue[] = [];
  let after: string | undefined;
  let viewer: LinearViewer | null = null;
  let pages = 0;
  const useOverride = Boolean(userIdOverride?.trim());

  while (pages < 20) {
    pages += 1;
    const data: GqlPage = useOverride
      ? await linearGraphql<GqlPage>(apiKey, VIEWER_AND_ISSUES, {
          after: after ?? null,
          assigneeId: userIdOverride,
        })
      : await linearGraphql<GqlPage>(apiKey, VIEWER_ISSUES_IS_ME, {
          after: after ?? null,
        });

    viewer = data.viewer;
    issues.push(...data.issues.nodes.map(mapIssue));
    if (!data.issues.pageInfo.hasNextPage || !data.issues.pageInfo.endCursor) {
      break;
    }
    after = data.issues.pageInfo.endCursor;
  }

  if (!viewer) {
    throw new Error("Could not resolve Linear viewer.");
  }

  return {
    syncedAt: new Date().toISOString(),
    viewer,
    issues,
    facets: buildFacets(issues),
  };
}
