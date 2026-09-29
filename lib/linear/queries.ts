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

export const ISSUE_NODE_FIELDS = `
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
        inverseRelations {
          nodes {
            type
            issue {
              id
              identifier
              title
            }
          }
        }`;

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
${ISSUE_NODE_FIELDS}
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
${ISSUE_NODE_FIELDS}
      }
    }
  }
`;

export type GqlIssueNode = {
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
  inverseRelations?: {
    nodes: {
      type: string;
      issue: { id: string; identifier: string; title: string } | null;
    }[];
  };
};

type GqlPage = {
  viewer: LinearViewer;
  issues: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    nodes: GqlIssueNode[];
  };
};

export function mapIssue(node: GqlIssueNode): LinearIssue {
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
    blockedBy: blockedByFromInverse(node),
  };
}

export function blockedByFromInverse(
  node: Pick<GqlIssueNode, "inverseRelations">,
): LinearIssue["blockedBy"] {
  const out: LinearIssue["blockedBy"] = [];
  for (const edge of node.inverseRelations?.nodes ?? []) {
    if (edge.type !== "blocks" || !edge.issue) continue;
    out.push({
      id: edge.issue.id,
      identifier: edge.issue.identifier,
      title: edge.issue.title,
    });
  }
  return out;
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

const TEAM_WORKFLOW_STATES = /* GraphQL */ `
  query TeamWorkflowStates($ids: [ID!]!) {
    teams(filter: { id: { in: $ids } }) {
      nodes {
        id
        states {
          nodes {
            id
            name
            type
            color
          }
        }
      }
    }
  }
`;

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

  const workflowStatesByTeamId = await loadWorkflowStates(apiKey, issues);

  return {
    syncedAt: new Date().toISOString(),
    viewer,
    issues,
    facets: buildFacets(issues),
    workflowStatesByTeamId,
  };
}

async function loadWorkflowStates(
  apiKey: string,
  issues: LinearIssue[],
): Promise<Record<string, LinearState[]>> {
  const teamIds = [
    ...new Set(
      issues
        .map((issue) => issue.team?.id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  if (teamIds.length === 0) return {};
  try {
    const data = await linearGraphql<{
      teams: { nodes: { id: string; states: { nodes: LinearState[] } }[] };
    }>(apiKey, TEAM_WORKFLOW_STATES, { ids: teamIds });
    const map: Record<string, LinearState[]> = {};
    for (const team of data.teams?.nodes ?? []) {
      map[team.id] = team.states?.nodes ?? [];
    }
    return map;
  } catch {
    return {};
  }
}
