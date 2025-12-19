# Visualization Explained (For Non-Technical Folks)

This UI shows what's happening inside the language model's "brain" as it generates text, one byte at a time.

## What You're Looking At

### Token Stream (Top Section)

**What it shows:** Each little box is one "token" (think of it like a letter or character) that the model has generated so far.

**Two viewing modes:**
- **ASCII mode** (default): Shows actual characters when possible (like 'h', 'e', 'l', 'l', 'o'), or a dot (·) for invisible characters like spaces/newlines
- **UTF-8 mode**: Shows the actual text as you'd read it, with the byte-level tokens shown below

**The highlighting:** Boxes pulse and glow based on what the model is "paying attention to" right now. This shows which previous parts of the text the model is looking back at to decide what comes next.

**Important caveat:** The highlighting shows attention, NOT causation. Just because a token lights up doesn't mean it "caused" the current output—it's just where the model allocated its attention. (Think of it like where someone's eyes look vs. what actually influences their decision.)

### Top-K Candidates (Middle Section)

**What it shows:** Before the model picks the next character, it considers multiple possibilities. These bubbles show the top 10 candidates.

**Bubble size:** Bigger bubble = higher probability the model assigned to that option
**Green bubble:** The one the model actually chose
**Gray bubbles:** The alternatives it considered but rejected

**Example interpretation:**
- If you see big bubbles with similar sizes, the model was "uncertain" (multiple good options)
- If one bubble is huge and the rest tiny, the model was "confident" (obvious next character)

### Confidence Bar (Bottom Section)

**What it shows:** How certain the model was about its choice.

**High confidence (green):** Model was very sure about the next character (e.g., completing "th" → "e" for "the")
**Low confidence (red):** Model was uncertain, many options seemed plausible

**The entropy number:** Technical measure of uncertainty. Lower = more certain. You can mostly ignore this and just watch the bar.

## What This Tells You

### The Model Is Predictable When...
- Confidence is high (green)
- One bubble dominates the top-k
- Attention focuses on a few recent tokens

**Example:** After typing "The cat sat on the ", the model is very confident the next word is "mat" or "floor"

### The Model Is Creative/Uncertain When...
- Confidence is low (red/orange)
- Multiple similar-sized bubbles in top-k
- Attention is spread across many tokens

**Example:** In the middle of a creative story, many directions are possible

## Common Misconceptions

❌ **"Attention shows what caused the output"**
- No—attention is just a distribution over previous tokens. The model looks at many things; correlation ≠ causation.

❌ **"High confidence = correct"**
- No—the model can be confidently wrong. This shows internal certainty, not truth.

❌ **"The UTF-8 view shows exactly what the model outputs"**
- Not quite—the model outputs bytes. UTF-8 decoding is our interpretation. Invalid byte sequences show as � (replacement character).

## Why This Is Interesting

1. **Transparency:** Most AI models are black boxes. This lets you peek inside at decision-making.

2. **Debugging:** If the model makes a weird choice, you can see if it was uncertain (low confidence) or if it got stuck attending to the wrong context.

3. **Understanding limitations:** You can see when the model is "guessing" vs. "confident," which helps calibrate trust.

4. **Educational:** Shows that language models don't "think"—they're sophisticated pattern-matching machines that pick one character at a time based on probability distributions.

## Technical Details (For The Curious)

- **Model architecture:** 4-layer decoder-only transformer, 256-token context, byte-level tokenization (vocab = 256)
- **Attention:** What you see is from one specific layer and head. Different layers/heads might attend to different patterns.
- **Sampling:** Model uses temperature=0.9 and top-k=50 by default (slightly random, not always the highest probability choice)
- **Layer/Head selection:** The dropdowns let you switch which attention pattern you're viewing (the model has 4 layers × 4 heads = 16 different attention "lenses")

## What You Can't See

- **Why the model learned these patterns:** Training on wikitext + personal corpus baked in certain biases and knowledge
- **Other layers' attention:** You're only seeing one layer at a time
- **The full probability distribution:** Only showing top-10, but there are 256 possible bytes
- **Computational cost:** Each token generation involves millions of floating-point operations (hidden behind the scenes)

---

**Bottom line:** This visualization turns an opaque AI into something observable, showing the probabilistic, step-by-step process of text generation. It's not magic—it's statistics and pattern matching, visualized.
