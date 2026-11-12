import fastifyStatic from "@fastify/static";
import type { ClassificationResult } from "@doc-triage/core";
import Fastify, { type FastifyInstance, type FastifyReply } from "fastify";
import { z, ZodError } from "zod";

export const MAX_TEXT_LENGTH = 50_000;

export const ClassifyRequestSchema = z.object({
  text: z.string().trim().min(1, "text is required").max(MAX_TEXT_LENGTH),
});

export interface AppOptions {
  readonly classify: (text: string) => Promise<ClassificationResult>;
  readonly webDist?: string | undefined;
  readonly logger?: boolean;
}

interface Problem {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly detail?: string;
  readonly errors?: readonly { path: string; message: string }[];
}

/** Builds the app without listening, so tests drive it with `app.inject()` and no open port. */
export async function buildApp(options: AppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    // Fastify does not log request bodies by default; documents contain PII, so keep it that way.
    logger: options.logger ?? false,
    bodyLimit: 256 * 1024,
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return sendProblem(reply, {
        type: "about:blank",
        title: "Invalid request",
        status: 400,
        errors: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    }
    const status = statusOf(error);
    if (status < 500) {
      return sendProblem(reply, {
        type: "about:blank",
        title: "Bad request",
        status,
        detail: messageOf(error),
      });
    }
    request.log.error(error);
    return sendProblem(reply, { type: "about:blank", title: "Internal server error", status: 500 });
  });

  app.get("/health", () => ({ status: "ok" }));

  app.post("/api/classify", async (request) => {
    const { text } = ClassifyRequestSchema.parse(request.body);
    return options.classify(text);
  });

  if (options.webDist) {
    await app.register(fastifyStatic, { root: options.webDist });
    // Single-page app: unknown GET routes outside /api fall back to index.html.
    app.setNotFoundHandler((request, reply) => {
      if (request.method === "GET" && !request.url.startsWith("/api/")) {
        return reply.sendFile("index.html");
      }
      return sendProblem(reply, { type: "about:blank", title: "Not found", status: 404 });
    });
  }

  return app;
}

function sendProblem(reply: FastifyReply, problem: Problem): FastifyReply {
  return reply.code(problem.status).type("application/problem+json").send(problem);
}

function statusOf(error: unknown): number {
  if (typeof error === "object" && error !== null && "statusCode" in error) {
    const { statusCode } = error;
    if (typeof statusCode === "number" && statusCode >= 400 && statusCode < 600) return statusCode;
  }
  return 500;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "Request could not be processed";
}
