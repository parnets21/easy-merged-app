// src/services/enquiryService.js
//
// Mirrors RetailerApp/src/services/enquiryService.js in API surface.
//
// ROLE: the wholesaler is the SELLER. The endpoints below cover the
// seller-side surface: list, reply, sendOffer, and the message/reply-history
// threads the wholesaler reads and writes. The retailer's twin is the
// buyer-side surface (create, cancel, respondToOffer). Only the endpoints
// this app's backend actually exposes are declared here.
import api from './api';

export const enquiryService = {
  // ── Core ──
  list:   (params = {}) => api.get('/enquiries', { params }),
  stats:  ()            => api.get('/enquiries/stats'),
  get:    (id)          => api.get(`/enquiries/${id}`),

  /**
   * Raise a broadcast enquiry.
   *
   * The wholesaler is normally the SELLER, but it can also ASK — e.g. sourcing
   * material it does not stock. The backend's `broadcastEnquiry` fans the
   * request out to one Enquiry row per recipient: every approved, active
   * retailer company, every approved, active wholesaler company, and the Admin
   * team. Each recipient answers on its own copy.
   *
   * The response carries `{ recipients, enquiry_code, ids }` — `recipients` is
   * how many companies were reached, so the screen never has to guess.
   */
  create: (body)        => api.post('/enquiries', body),

  /**
   * Partial update — moves the status along (`{ status: 'Viewed' }` on open)
   * and carries the wholesaler's quote back (`{ status: 'Replied',
   * offered_price, available_quantity, delivery_timeline, remarks }`).
   */
  update: (id, data)    => api.patch(`/enquiries/${id}`, data),

  /** Alias of `update` — the named `reply` endpoint for manual enquiries. */
  reply:  (id, data)    => api.patch(`/enquiries/${id}`, data),

  /** Wholesaler rejects / withdraws from an enquiry. */
  cancel: (id, reason = '') =>
    api.patch(`/enquiries/${id}/cancel`, { reason }),

  // ── Marketplace offers (retailer enquiries with buyer_company_id) ──
  // Structured offer (unit_price, gst_percent, charges…) via EnquiryOffer flow.
  sendOffer:   (id, data) => api.post(`/enquiries/${id}/offers`, data),
  listOffers:  (id)       => api.get(`/enquiries/${id}/offers`),

  // ── Message thread ──
  listMessages: (enquiryId) =>
    api.get(`/enquiries/${enquiryId}/messages`),
  sendMessage: (enquiryId, message, clientMessageId = '') =>
    api.post(`/enquiries/${enquiryId}/messages`, {
      message,
      client_message_id: clientMessageId,
    }),

  // ── Replies to a broadcast ──
  // One call returns the whole roster: who answered (with their company details,
  // price and availability) and who has not. Useful when the wholesaler can see
  // sibling enquiries sharing one enq_code.
  listReplies: (enquiryId) => api.get(`/enquiries/${enquiryId}/replies`),

  // ── Reply history — every reply ever sent, in order ──
  listReplyHistory: (enquiryId) => api.get(`/enquiries/${enquiryId}/reply-history`),
  createReplyHistory: (enquiryId, data) => api.post(`/enquiries/${enquiryId}/reply-history`, data),

  // ── Offers (the seller quotes, the retailer accepts/declines) ──
  respondToOffer: (enquiryId, offerId, action) =>
    api.patch(`/enquiries/${enquiryId}/offers/${offerId}`, { action }),
};

export default enquiryService;
