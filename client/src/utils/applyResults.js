import { formatFileDateFromEpoch } from "./dates.js";
import { getChosenPhotoTakenReference } from "./photoTaken.js";

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

      const { display: referenceDisplay } = getChosenPhotoTakenReference(file);
      const display = referenceDisplay ?? formatted;

      return {
        ...file,
        photoTakenEpoch: epoch,
        fileDates: {
          ...file.fileDates,
          createdAt: display,
          modifiedAt: display,
          createdAtEpoch: epoch,
          modifiedAtEpoch: epoch,
        },
      };
    }),
  };
}
