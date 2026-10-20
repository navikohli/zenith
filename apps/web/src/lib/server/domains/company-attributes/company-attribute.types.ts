import type { CompanyAttributeId } from '@zenith/ids'
import type {
  AttributeDefinitionRecord,
  CreateAttributeDefinitionInput,
  UpdateAttributeDefinitionInput,
} from '@/lib/server/domains/attribute-definitions/attribute-definition.types'

export type CompanyAttribute = AttributeDefinitionRecord<CompanyAttributeId>
export type CreateCompanyAttributeInput = CreateAttributeDefinitionInput
export type UpdateCompanyAttributeInput = UpdateAttributeDefinitionInput
