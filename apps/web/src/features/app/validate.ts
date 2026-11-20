import { blockSchema, hasImage, type Block } from "@linkyo/blocks";

/** Field errors by path ("title", "items.0.url"), as message keys under app.errors. */
export type FieldErrors = Record<string, string>;

/**
 * Validates a block with the same schema the API uses, plus what a page needs to look finished
 * (an image block needs a picture). Returns the first problem per field, or null when it can be saved.
 */
export function validateBlock(block: Block): FieldErrors | null {
  const errors: FieldErrors = {};
  const result = blockSchema.safeParse(block);
  if (!result.success) {
    for (const issue of result.error.issues) {
      const path = issue.path.join(".");
      if (errors[path]) continue;
      const origin = "origin" in issue ? issue.origin : undefined;
      errors[path] =
        issue.code === "too_small"
          ? origin === "array"
            ? "atLeastOne"
            : "required"
          : issue.code === "too_big"
            ? "tooLong"
            : issue.code === "invalid_format" && "format" in issue && issue.format === "url"
              ? "url"
              : "invalid";
    }
  }
  if (block.type === "image" && !hasImage(block.image)) errors["image.src"] = "imageRequired";
  // Owner and repository come from the GitHub address: a problem with them is a problem with the link.
  if (block.type === "repo" && (errors.owner || errors.repo || errors.url)) {
    delete errors.owner;
    delete errors.repo;
    errors.url = "githubUrl";
  }
  if (block.type === "gallery") {
    if (block.images.length === 0) errors.images = "atLeastOne";
    block.images.forEach((image, index) => {
      if (!hasImage(image)) errors[`images.${index}.src`] = "imageRequired";
    });
  }
  return Object.keys(errors).length > 0 ? errors : null;
}
