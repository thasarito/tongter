import { describe, expect, it } from "vitest";
import type { RsvpFormView } from "@/shared/views";
import { rsvpPayloadFromForm } from "./rsvp";

const view: RsvpFormView = {
  kind: "form",
  status: "ok",
  token: "group-token",
  groupLabel: "Friends",
  hasResponded: false,
  submittedBy: "",
  dietaryOptions: [],
  allowDietaryOther: true,
  fieldNames: { token: "token", lang: "lang", submittedBy: "submittedBy" },
  guests: [
    {
      guestId: "guest-1",
      name: "One",
      tableId: 1,
      seatIndex: 1,
      attending: null,
      dietary: { selected: [], other: "" },
      note: "",
      fieldNames: {
        attending: "attending_guest-1",
        dietary: "dietary_guest-1",
        dietaryOther: "dietaryOther_guest-1",
        note: "note_guest-1",
      },
    },
    {
      guestId: "guest-2",
      name: "Two",
      tableId: 1,
      seatIndex: 2,
      attending: null,
      dietary: { selected: [], other: "" },
      note: "",
      fieldNames: {
        attending: "attending_guest-2",
        dietary: "dietary_guest-2",
        dietaryOther: "dietaryOther_guest-2",
        note: "note_guest-2",
      },
    },
  ],
};

describe("rsvpPayloadFromForm", () => {
  it("serializes only answered guests and identifies the submitter by guest ID", () => {
    const form = new FormData();
    form.set("attending_guest-1", "yes");
    form.append("dietary_guest-1", "vegetarian");
    form.append("dietary_guest-1", "halal");
    form.set("dietaryOther_guest-1", "No peanuts");
    form.set("note_guest-1", "See you there");

    expect(rsvpPayloadFromForm(view, "guest-1", "en", form)).toEqual({
      submittedBy: "guest-1",
      lang: "en",
      answers: [
        {
          guestId: "guest-1",
          attending: true,
          dietary: ["vegetarian", "halal"],
          dietaryOther: "No peanuts",
          note: "See you there",
        },
      ],
    });
  });
});
