import { fileDateMatchesReference } from "./dates.js";
import { getChosenPhotoTakenReference } from "./photoTaken.js";

export function getDateMismatch(file) {
  const { display: referenceDisplay, epoch: referenceEpoch } =
    getChosenPhotoTakenReference(file);

  if (referenceDisplay == null && referenceEpoch == null) {
    return { hasMismatch: false, createdMismatch: false, modifiedMismatch: false };
  }

  const createdMatches = fileDateMatchesReference(
    {
      display: file.fileDates?.createdAt ?? null,
      epoch: file.fileDates?.createdAtEpoch ?? null,
    },
    referenceDisplay,
    referenceEpoch,
  );
  const modifiedMatches = fileDateMatchesReference(
    {
      display: file.fileDates?.modifiedAt ?? null,
      epoch: file.fileDates?.modifiedAtEpoch ?? null,
    },
    referenceDisplay,
    referenceEpoch,
  );

  return {
    hasMismatch: !(createdMatches && modifiedMatches),
    createdMismatch: !createdMatches,
    modifiedMismatch: !modifiedMatches,
  };
}
