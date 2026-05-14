import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./documents.repository', () => ({
  getDocumentsBySupplierId: vi.fn(),
  uploadDocumentFile: vi.fn(),
  createDocument: vi.fn(),
  getDocumentBySupplierAndId: vi.fn(),
  updateDocumentStatus: vi.fn(),
  deleteDocumentRow: vi.fn(),
  removeDocumentFileFromStorage: vi.fn(),
}));

import * as repo from './documents.repository';
import {
  listDocuments,
  uploadDocument,
  approveDocument,
  rejectDocument,
  deleteDocument,
} from './documents.service';

const mockDoc = {
  id: 'd-1',
  supplier_id: 's-1',
  document_name: 'Contract.pdf',
  status: 'pending',
  file_path: 's-1/123-Contract.pdf',
};

describe('listDocuments', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns documents on success', async () => {
    vi.mocked(repo.getDocumentsBySupplierId).mockResolvedValue({ data: [mockDoc], error: null } as any);
    const result = await listDocuments('s-1');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toHaveLength(1);
  });

  it('returns 500 on repository error', async () => {
    vi.mocked(repo.getDocumentsBySupplierId).mockResolvedValue({ data: null, error: { message: 'DB error' } } as any);
    const result = await listDocuments('s-1');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(500);
  });
});

describe('uploadDocument', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uploads file to storage and creates DB row', async () => {
    vi.mocked(repo.uploadDocumentFile).mockResolvedValue({ path: 's-1/file.pdf', error: null });
    vi.mocked(repo.createDocument).mockResolvedValue({ data: mockDoc, error: null } as any);
    const file = { originalname: 'file.pdf', buffer: Buffer.from(''), mimetype: 'application/pdf' } as any;
    const result = await uploadDocument('s-1', { title: 'Contract' }, 'user-1', file);
    expect(result.ok).toBe(true);
    expect(repo.uploadDocumentFile).toHaveBeenCalledOnce();
  });

  it('creates DB row without file when no file provided', async () => {
    vi.mocked(repo.createDocument).mockResolvedValue({ data: mockDoc, error: null } as any);
    const result = await uploadDocument('s-1', { title: 'Contract' }, 'user-1', undefined);
    expect(result.ok).toBe(true);
    expect(repo.uploadDocumentFile).not.toHaveBeenCalled();
  });

  it('returns 400 when storage upload fails', async () => {
    vi.mocked(repo.uploadDocumentFile).mockResolvedValue({ path: null, error: new Error('Storage error') });
    const file = { originalname: 'file.pdf', buffer: Buffer.from(''), mimetype: 'application/pdf' } as any;
    const result = await uploadDocument('s-1', { title: 'Contract' }, 'user-1', file);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });
});

describe('approveDocument', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sets status to approved', async () => {
    vi.mocked(repo.updateDocumentStatus).mockResolvedValue({ data: { ...mockDoc, status: 'approved' }, error: null } as any);
    const result = await approveDocument('d-1', 'user-1');
    expect(result.ok).toBe(true);
  });

  it('returns 400 on repository error', async () => {
    vi.mocked(repo.updateDocumentStatus).mockResolvedValue({ data: null, error: { message: 'fail' } } as any);
    const result = await approveDocument('d-1', 'user-1');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });
});

describe('rejectDocument', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sets status to rejected', async () => {
    vi.mocked(repo.updateDocumentStatus).mockResolvedValue({ data: { ...mockDoc, status: 'rejected' }, error: null } as any);
    const result = await rejectDocument('d-1', 'user-1');
    expect(result.ok).toBe(true);
  });
});

describe('deleteDocument', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes pending document and removes storage file', async () => {
    vi.mocked(repo.getDocumentBySupplierAndId).mockResolvedValue({ data: mockDoc, error: null } as any);
    vi.mocked(repo.removeDocumentFileFromStorage).mockResolvedValue({ error: null });
    vi.mocked(repo.deleteDocumentRow).mockResolvedValue({ error: null } as any);
    const result = await deleteDocument('s-1', 'd-1');
    expect(result.ok).toBe(true);
    expect(repo.removeDocumentFileFromStorage).toHaveBeenCalledOnce();
  });

  it('returns 400 when document is not pending', async () => {
    vi.mocked(repo.getDocumentBySupplierAndId).mockResolvedValue({
      data: { ...mockDoc, status: 'approved' }, error: null,
    } as any);
    const result = await deleteDocument('s-1', 'd-1');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });

  it('returns 404 when document not found', async () => {
    vi.mocked(repo.getDocumentBySupplierAndId).mockResolvedValue({ data: null, error: null } as any);
    const result = await deleteDocument('s-1', 'd-1');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(404);
  });

  it('returns 500 when fetch fails', async () => {
    vi.mocked(repo.getDocumentBySupplierAndId).mockResolvedValue({ data: null, error: { message: 'DB error' } } as any);
    const result = await deleteDocument('s-1', 'd-1');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(500);
  });
});
