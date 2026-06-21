import { formatFileDateFromEpoch } from "./dates.js";

export function mergeApplyResults(prevData, results) {
  const appliedByPath = new Map(
    results.filter((result) => result.ok).map((result) => [result.path, result.photoTakenEpoch]),
  );

  if (appliedByPath.size === 0 || !prevData?.files) {
    return prevData;
  }

  return {
    ...prevData,
    files: prevData.files.map((file) => {
      const epoch = appliedByPath.get(file.path);
      if (epoch == null) {
        return file;
      }

      const formatted = formatFileDateFromEpoch(epoch);
      if (formatted == null) {
        return file;
      }
      return {
        ...file,
        fileDates: {
          ...file.fileDates,
          createdAt: formatted,
          modifiedAt: formatted,
          createdAtEpoch: epoch,
          modifiedAtEpoch: epoch,
        },
      };
    }),
  };
}
