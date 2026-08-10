// Shared definitions for the CRM pipeline stages + behaviour tags, including a
// plain-English description of each (why it exists, how it's used, an example,
// and exactly how a customer gets tagged with it).

export type TagInfo = {
  id: string;
  label: string;
  why: string;
  how: string;
  example: string;
  tagged: string;
};

export const PIPELINE_TAGS: TagInfo[] = [
  {
    id: "lead", label: "Lead",
    why: "Turn people who signed up but never bought into first-time customers.",
    how: "Welcome them and gently nudge a first order.",
    example: "“Welcome to thepufflette.co — here's a treat to start with.”",
    tagged: "Signed in / captured, but has no paid order yet.",
  },
  {
    id: "new", label: "New customer",
    why: "Turn a first order into a second — and a happy review.",
    how: "Thank them, set expectations, then encourage a reorder.",
    example: "“Thanks for your first order, {first_name}! Here's what's next.”",
    tagged: "Has placed exactly 1 paid order.",
  },
  {
    id: "repeat", label: "Repeat",
    why: "Build loyalty with customers who keep coming back.",
    how: "Surface favourites and ask them to refer a friend.",
    example: "“Your favourites are one tap away.”",
    tagged: "Has 2–4 paid orders.",
  },
  {
    id: "vip", label: "VIP",
    why: "Reward and retain your most valuable customers.",
    how: "Give perks, early access and genuine thanks.",
    example: "“A little thank-you for being one of our best.”",
    tagged: "5+ paid orders OR has spent ₦50,000+.",
  },
  {
    id: "at_risk", label: "At-risk",
    why: "Re-engage customers before they drift away.",
    how: "A gentle ‘we miss you' nudge.",
    example: "“We saved your spot — fancy a cake this week?”",
    tagged: "Has ordered before, but not in the last 30 days.",
  },
  {
    id: "lapsed", label: "Lapsed",
    why: "Win back customers who've gone cold.",
    how: "A stronger incentive to return.",
    example: "“Here's a little something to welcome you back.”",
    tagged: "No paid order in 60+ days.",
  },
];

export const BEHAVIOUR_TAGS: TagInfo[] = [
  {
    id: "all", label: "All customers",
    why: "Reach your whole list for announcements and offers.",
    how: "Broadcasts and general news.",
    example: "“New on the menu this week 🍰”",
    tagged: "Every customer with an email address.",
  },
  {
    id: "checkout", label: "Abandoned checkout",
    why: "Recover almost-completed orders quickly.",
    how: "A fast nudge back to checkout.",
    example: "“You're one step away — finish your order.”",
    tagged: "Started checkout but didn't pay (signed-in).",
  },
  {
    id: "cart", label: "Added to cart",
    why: "Bring back people who added something but didn't buy.",
    how: "A friendly cart reminder.",
    example: "“Your {product} is still waiting 👀”",
    tagged: "Added an item to their cart (signed-in).",
  },
  {
    id: "viewed", label: "Viewed a product",
    why: "Rekindle interest after someone browses.",
    how: "Highlight what they looked at.",
    example: "“Still thinking about {product}?”",
    tagged: "Opened a product page (signed-in).",
  },
];

export const ALL_TAGS = [...PIPELINE_TAGS, ...BEHAVIOUR_TAGS];
export const tagInfo = (id: string) => ALL_TAGS.find((t) => t.id === id);
