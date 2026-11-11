# Proposal: a bigger role for Gemini (not built, for my decision)

The reviewer said the AI role is small and that a bigger role is my call. I decided not to build it now. This page describes the smallest version so I can decide.

## Scope

1. **Explain the conflict.** Gemini writes two or three plain sentences for Chloe about the overlap. It may use only facts the server has already verified: the bus runs 2 to 6 PM, the shift runs 4 to 10 PM, the overlap is 4 to 6 PM, and the swap was declined.
2. **Answer "what are my options?"** Chloe picks from a short fixed list of questions, such as "ask Dana for coverage", "ask a teammate to swap", or "tell the coach about the shuttle". Gemini may only choose among options the server lists. Every factual sentence still comes from the server.
3. **The open demo keeps zero AI calls.** Both features exist only in the signed-in version.

## Risks and tests that would catch them

| Risk | Test that would catch it |
| --- | --- |
| Gemini states a wrong time, place, or swap status. | Unit test: reject any output that contains a time, name, or place not in the server's verified list. Mocked bad outputs. |
| Gemini invents an option, such as "ask HR". | Unit test: the output must be a list of option IDs from the server's list. Anything else is rejected. |
| Tone is pushy or promises an outcome ("Dana will cover you"). | Unit test on fixed wording: the server writes the sentences and Gemini only picks IDs. Plus a manual read of every sample output before the demo. |
| The open demo makes an AI call. | Browser test: the open demo makes no request to the AI route, and the AI route returns 401 without sign-in (an existing test covers the 401). |
| Extra cost or quota use. | Reuse the existing request limit. No new paid service. |

## Extra hours

My estimate is 6 to 9 hours: 2 for the server-side option list and checks, 2 for the screen, 2 for tests, 1 to 3 for one real signed-in check and a read-through. This is an estimate, not a measurement.

## Recommendation

**No, not now.** The current build already shows a complete flow, and the main open items are the demo recording and a real second-account check. The extra feature adds risk of wrong facts for little gain in what the demo can show, since the open demo cannot use it. I would revisit it only if I have spare hours after the recording.
