import { describe, expect, it } from 'vitest'
import { getTableConfig } from 'drizzle-orm/pg-core'
import { feedbackWork, productUserBindings } from '../feedback'
import { posts } from '../posts'

describe('durable feedback schema', () => {
  it('resolves cyclic post/binding relationships and preserves the work history reference', () => {
    const work = getTableConfig(feedbackWork)
    expect(work.foreignKeys.map((f) => f.reference().foreignTable)).toContain(posts)
    expect(getTableConfig(posts).foreignKeys.map((f) => f.reference().foreignTable)).toContain(
      productUserBindings
    )
    expect(work.checks.map((c) => c.name)).toContain('feedback_work_phase_check')
    expect(work.indexes.map((i) => i.config.name)).toContain('feedback_work_product_phase_idx')
  })
})
