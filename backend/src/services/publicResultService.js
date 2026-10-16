import * as serialize from './serializers.js';
import { PRIORITY_RANK } from './screeningService.js';
import { unwrap } from './db.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * The two things a patient can do without an account: send a request, and
 * follow it with the access code it returns.
 *
 * There is no database user behind either, so both run with the service role.
 * That is why they are kept this narrow: the request writes one row through
 * create_request() (which allocates the code), and the lookup returns only the
 * small shape in `serialize.publicStatus`.
 *
 * A code that is malformed and a code that does not exist are answered the
 * same way, so the response teaches a guesser nothing.
 */

/** The alphabet create_request() draws from: A-Z without I and O, and 2-9. */
const CODE = /^[A-HJ-NP-Z2-9]{8}$/;

const NOT_FOUND = 'Kode akses tidak ditemukan. Periksa kembali kode yang kamu terima.';

/** "k7m2-9qxp", "K7M2 9QXP" and "K7M29QXP" are the same code. */
export function normaliseCode(input) {
  return String(input ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

export async function request(admin, input) {
  const applicant = {
    name: input.name,
    sex: input.sex,
    birthDate: input.birthDate,
    phone: input.phone || null,
    address: input.address ?? '',
  };
  const row = unwrap(
    await admin.rpc('create_request', { p_patient_id: null, p_applicant: applicant, p_complaint: input.complaint }),
  );
  return { code: row.access_code, requestDate: row.request_date, requestedAt: new Date(row.requested_at).toISOString() };
}

/** How many people are ahead: in the line for the X-ray, or in the queue after it. */
async function countAhead(admin, row) {
  if (row.status === 'waiting') {
    const { count, error } = await admin
      .from('screenings')
      .select('id', { count: 'exact', head: true })
      .eq('request_date', row.request_date)
      .in('status', ['waiting', 'examining'])
      .lt('requested_at', row.requested_at);
    if (error) throw error;
    return count ?? 0;
  }
  if (row.status === 'queued') {
    const others = unwrap(
      await admin
        .from('screenings')
        .select('id,queue_priority,submitted_at')
        .eq('queue_date', row.queue_date)
        .eq('status', 'queued')
        .neq('id', row.id),
    );
    const mine = PRIORITY_RANK[row.queue_priority];
    return others.filter(
      (other) =>
        PRIORITY_RANK[other.queue_priority] < mine ||
        (PRIORITY_RANK[other.queue_priority] === mine && String(other.submitted_at) < String(row.submitted_at)),
    ).length;
  }
  return null;
}

export async function lookup(admin, rawCode) {
  const code = normaliseCode(rawCode);
  if (!CODE.test(code)) throw ApiError.notFound(NOT_FOUND);

  const row = unwrap(
    await admin
      .from('screenings')
      .select(
        'id,status,applicant,request_date,requested_at,queue_number,queue_priority,queue_date,' +
          'submitted_at,served_at,analysis,patients(name)',
      )
      .eq('access_code', code)
      .maybeSingle(),
  );
  if (!row) throw ApiError.notFound(NOT_FOUND);
  return serialize.publicStatus(row, { ahead: await countAhead(admin, row) });
}
