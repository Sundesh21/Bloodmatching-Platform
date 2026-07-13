// Standard ABO/Rh red-cell compatibility.
// Key = recipient blood group, value = donor groups whose red cells they can receive.
export const COMPATIBLE_DONORS = {
  "O-": ["O-"],
  "O+": ["O-", "O+"],
  "A-": ["O-", "A-"],
  "A+": ["O-", "O+", "A-", "A+"],
  "B-": ["O-", "B-"],
  "B+": ["O-", "O+", "B-", "B+"],
  "AB-": ["O-", "A-", "B-", "AB-"],
  "AB+": ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"],
};

// Recipients a given donor group can donate to (inverse of the table above).
export function recipientsFor(donorGroup) {
  return Object.entries(COMPATIBLE_DONORS)
    .filter(([, donors]) => donors.includes(donorGroup))
    .map(([recipient]) => recipient);
}
