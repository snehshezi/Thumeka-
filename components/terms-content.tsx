import { APP_NAME } from "@/lib/constants";

/**
 * Body of the Terms & Conditions, used by both the standalone /terms page
 * and the registration-flow modal. Page chrome (hero band, TOC sidebar)
 * lives in the page; the modal renders this directly inside its scroll area.
 */
export function TermsContent() {
  return (
    <div
      className="space-y-10 text-body text-black/75 leading-7"
      data-testid="terms-content"
    >
      <section id="section-1" className="scroll-mt-24">
        <h2 className="text-h2 text-ink">1. Introduction</h2>
        <p className="mt-3">
          {APP_NAME} is a digital marketplace that connects customers with
          independent sellers, service providers, runners, and drivers
          through our platform.
        </p>
        <p className="mt-3">
          These Terms and Conditions govern your access to the use of the{" "}
          {APP_NAME} platform, website, mobile application, products, and
          services. By registering for an account or using our platform, you
          agree to be bound by these Terms.
        </p>
      </section>

      <section id="section-2" className="scroll-mt-24">
        <h2 className="text-h2 text-ink">2. Definitions</h2>
        <p className="mt-3 font-semibold text-ink">
          For the purposes of these Terms:
        </p>
        <ul className="mt-3 space-y-2">
          <li>
            <strong className="text-ink">Customer</strong> means any person
            who purchases products or services through {APP_NAME}.
          </li>
          <li>
            <strong className="text-ink">Seller</strong> means a person or
            business authorised to sell products through the platform.
          </li>
          <li>
            <strong className="text-ink">Service Provider</strong> means a
            person or business offering services through the platform.
          </li>
          <li>
            <strong className="text-ink">Runner</strong> means a person
            authorised to perform errands, collections, deliveries, or
            related tasks through {APP_NAME}.
          </li>
          <li>
            <strong className="text-ink">Driver</strong> means a person
            authorised to provide transportation or delivery services
            through the platform.
          </li>
          <li>
            <strong className="text-ink">Platform</strong> means the{" "}
            {APP_NAME} website, mobile application, and related systems.
          </li>
        </ul>
      </section>

      <section id="section-3" className="scroll-mt-24">
        <h2 className="text-h2 text-ink">3. Eligibility</h2>
        <p className="mt-3">
          Users must be at least 18 years old and legally capable of entering
          into binding agreements.
        </p>
        <p className="mt-3">
          By registering, you warrant that all information provided is
          accurate, complete, and current.
        </p>
      </section>

      <section id="section-4" className="scroll-mt-24">
        <h2 className="text-h2 text-ink">4. Account Registration</h2>
        <p className="mt-3">Users may register as:</p>
        <ul className="mt-3 list-disc space-y-1 pl-6">
          <li>Customers</li>
          <li>Sellers</li>
          <li>Service Providers</li>
          <li>Runners</li>
          <li>Drivers</li>
        </ul>
        <p className="mt-3">
          You are responsible for maintaining the confidentiality of your
          account credentials and for all activities conducted under your
          account.
        </p>
        <p className="mt-3">
          {APP_NAME} reserves the right to suspend or terminate accounts
          containing false, misleading, or fraudulent information.
        </p>
      </section>

      <section id="section-5" className="scroll-mt-24">
        <h2 className="text-h2 text-ink">5. Vetting and Verification</h2>
        <p className="mt-3">
          To protect our community and maintain high service standards:
        </p>
        <h3 className="mt-4 text-h3 text-ink">Sellers</h3>
        <p className="mt-2">
          All sellers are subject to a vetting process which may include:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-6">
          <li>Identity verification</li>
          <li>Business registration verification (where applicable)</li>
          <li>Product quality assessments</li>
          <li>Compliance reviews</li>
        </ul>
        <h3 className="mt-4 text-h3 text-ink">Drivers and Runners</h3>
        <p className="mt-2">
          All drivers and runners are subject to verification which may
          include:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-6">
          <li>Identity verification</li>
          <li>Driver&apos;s license verification</li>
          <li>Vehicle documentation checks</li>
          <li>Criminal background screening where legally permitted</li>
          <li>Reference verification</li>
        </ul>
        <p className="mt-3">
          Approval is granted solely at {APP_NAME}&apos;s discretion.
        </p>
        <p className="mt-3">
          {APP_NAME} reserves the right to reject, suspend, or remove any
          seller, driver, runner, or service provider that fails to meet our
          standards.
        </p>
      </section>

      <section id="section-6" className="scroll-mt-24">
        <h2 className="text-h2 text-ink">6. Marketplace Services</h2>
        <p className="mt-3">
          {APP_NAME} provides a platform that facilitates transactions
          between customers and independent sellers, service providers,
          drivers, and runners.
        </p>
        <p className="mt-3">
          While we take pride in maintaining a trusted marketplace and
          strive to ensure quality products and services, sellers and
          service providers remain responsible for the products and
          services they offer.
        </p>
      </section>

      <section id="section-7" className="scroll-mt-24">
        <h2 className="text-h2 text-ink">7. Product Quality Standards</h2>
        <p className="mt-3">
          {APP_NAME} is committed to maintaining a high-quality marketplace.
        </p>
        <p className="mt-3">Sellers agree that:</p>
        <ul className="mt-2 list-disc space-y-1 pl-6">
          <li>Products must be genuine, legal, and accurately described.</li>
          <li>Products must meet applicable quality and safety standards.</li>
          <li>
            Counterfeit, stolen, dangerous, or prohibited products are
            strictly forbidden.
          </li>
          <li>Product listings must not contain misleading information.</li>
        </ul>
        <p className="mt-3">
          {APP_NAME} may remove any listing that does not meet our standards.
        </p>
      </section>

      <section id="section-8" className="scroll-mt-24">
        <h2 className="text-h2 text-ink">8. Service Standards</h2>
        <p className="mt-3">
          Service providers, runners, and drivers must:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-6">
          <li>Act professionally and respectfully.</li>
          <li>Complete assignments diligently and safely.</li>
          <li>Maintain all legally required licenses and permits.</li>
          <li>Comply with all applicable laws and regulations.</li>
        </ul>
        <p className="mt-3">
          Repeated customer complaints or poor service may result in
          suspension or removal from the platform.
        </p>
      </section>

      <section id="section-9" className="scroll-mt-24">
        <h2 className="text-h2 text-ink">9. Orders and Payments</h2>
        <p className="mt-3">
          Customers agree to pay all applicable fees displayed at checkout.
        </p>
        <p className="mt-3">
          Payments processed through {APP_NAME} may include:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-6">
          <li>Product costs</li>
          <li>Service fees</li>
          <li>Delivery fees</li>
          <li>Platform fees</li>
          <li>Applicable taxes</li>
        </ul>
        <p className="mt-3">
          {APP_NAME} reserves the right to cancel orders where fraud,
          pricing errors, or security concerns are suspected.
        </p>
      </section>

      <section id="section-10" className="scroll-mt-24">
        <h2 className="text-h2 text-ink">10. Delivery Services</h2>
        <p className="mt-3">
          Estimated delivery times are provided for convenience only and are
          not guaranteed.
        </p>
        <p className="mt-3">
          Drivers and runners shall make reasonable efforts to complete
          deliveries within the estimated timeframe.
        </p>
        <p className="mt-3">
          {APP_NAME} shall not be liable for delays caused by:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-6">
          <li>Traffic</li>
          <li>Weather conditions</li>
          <li>Force majeure events</li>
          <li>Incorrect customer information</li>
          <li>Circumstances beyond reasonable control</li>
        </ul>
      </section>

      <section id="section-11" className="scroll-mt-24">
        <h2 className="text-h2 text-ink">11. Refunds and Returns</h2>
        <p className="mt-3">
          Refunds and returns shall be governed by applicable consumer
          protection laws and {APP_NAME}&apos;s Refund Policy.
        </p>
        <p className="mt-3">Refund requests may be approved where:</p>
        <ul className="mt-2 list-disc space-y-1 pl-6">
          <li>Products are defective</li>
          <li>Products differ materially from descriptions</li>
          <li>Services were not delivered as agreed</li>
          <li>Deliveries were not completed</li>
        </ul>
        <p className="mt-3">
          Evidence may be required before refunds are processed.
        </p>
      </section>

      <section id="section-12" className="scroll-mt-24">
        <h2 className="text-h2 text-ink">12. Prohibited Activities</h2>
        <p className="mt-3">Users may not:</p>
        <ul className="mt-2 list-disc space-y-1 pl-6">
          <li>Commit fraud or deception</li>
          <li>Use stolen payment methods</li>
          <li>
            Sell illegal, counterfeit, dangerous, or prohibited products
          </li>
          <li>Harass other users</li>
          <li>Manipulate reviews or ratings</li>
          <li>Interfere with platform operations</li>
          <li>Misrepresent identity, qualifications, or products</li>
        </ul>
        <p className="mt-3">
          Violation of this section may result in immediate account
          termination.
        </p>
      </section>

      <section id="section-13" className="scroll-mt-24">
        <h2 className="text-h2 text-ink">13. Ratings and Reviews</h2>
        <p className="mt-3">
          Customers may provide ratings and reviews based on genuine
          experiences.
        </p>
        <p className="mt-3">
          {APP_NAME} reserves the right to remove reviews that are:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-6">
          <li>False</li>
          <li>Abusive</li>
          <li>Defamatory</li>
          <li>Misleading</li>
          <li>Offensive</li>
        </ul>
      </section>

      <section id="section-14" className="scroll-mt-24">
        <h2 className="text-h2 text-ink">14. Intellectual Property</h2>
        <p className="mt-3">
          All trademarks, logos, branding, software, content, and
          intellectual property associated with {APP_NAME} remain the
          exclusive property of {APP_NAME} unless otherwise stated.
        </p>
        <p className="mt-3">
          Users may not reproduce, distribute, or exploit platform content
          without written permission.
        </p>
      </section>

      <section id="section-15" className="scroll-mt-24">
        <h2 className="text-h2 text-ink">15. Limitation of Liability</h2>
        <p className="mt-3">
          To the maximum extent permitted by law, {APP_NAME} shall not be
          liable for indirect, incidental, consequential, special, or
          punitive damages arising from:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-6">
          <li>Platform use</li>
          <li>Product defects</li>
          <li>Service failures</li>
          <li>Delivery delays</li>
          <li>User conduct</li>
        </ul>
        <p className="mt-3">
          Where liability cannot legally be excluded, {APP_NAME}&apos;s
          liability shall be limited to the amount paid for the relevant
          transaction.
        </p>
      </section>

      <section id="section-16" className="scroll-mt-24">
        <h2 className="text-h2 text-ink">16. Indemnity</h2>
        <p className="mt-3">
          Users agree to indemnify and hold harmless {APP_NAME}, its
          directors, officers, employees, agents, and affiliates against any
          claims, damages, liabilities, costs, and expenses arising from:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-6">
          <li>Breach of these Terms</li>
          <li>Violation of applicable laws</li>
          <li>Misconduct on the platform</li>
        </ul>
      </section>

      <section id="section-17" className="scroll-mt-24">
        <h2 className="text-h2 text-ink">17. Privacy and Data Protection</h2>
        <p className="mt-3">
          {APP_NAME} respects user privacy and processes personal
          information in accordance with applicable data protection laws,
          including the Protection of Personal Information Act (POPIA) where
          applicable.
        </p>
        <p className="mt-3">
          By using the platform, users consent to the collection, storage,
          and processing of personal information necessary to provide
          services.
        </p>
      </section>

      <section id="section-18" className="scroll-mt-24">
        <h2 className="text-h2 text-ink">18. Suspension and Termination</h2>
        <p className="mt-3">
          {APP_NAME} may suspend or terminate accounts without notice where:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-6">
          <li>Fraud is suspected</li>
          <li>Vetting requirements are no longer met</li>
          <li>Users breach these Terms</li>
          <li>
            User conduct threatens the safety or integrity of the platform
          </li>
        </ul>
      </section>

      <section id="section-19" className="scroll-mt-24">
        <h2 className="text-h2 text-ink">19. Dispute Resolution</h2>
        <p className="mt-3">
          Users agree to first attempt to resolve disputes through good-faith
          negotiations with {APP_NAME}.
        </p>
        <p className="mt-3">
          If a dispute cannot be resolved amicably, it shall be referred to
          mediation before legal proceedings are initiated, unless otherwise
          required by law.
        </p>
      </section>

      <section id="section-20" className="scroll-mt-24">
        <h2 className="text-h2 text-ink">20. Amendments</h2>
        <p className="mt-3">
          {APP_NAME} may amend these Terms from time to time.
        </p>
        <p className="mt-3">
          Updated Terms will be published on the platform and become
          effective upon publication. Continued use of the platform
          constitutes acceptance of any revised Terms.
        </p>
      </section>

      <section id="section-21" className="scroll-mt-24">
        <h2 className="text-h2 text-ink">21. Governing Law</h2>
        <p className="mt-3">
          These Terms shall be governed by and interpreted in accordance
          with the laws of the Republic of South Africa.
        </p>
        <p className="mt-3">
          Any disputes shall be subject to the jurisdiction of the South
          African courts.
        </p>
      </section>

      <section id="section-22" className="scroll-mt-24">
        <h2 className="text-h2 text-ink">22. Contact Information</h2>
        <div className="panel mt-4 space-y-2 p-5">
          <p className="font-semibold text-ink">{APP_NAME.toUpperCase()}</p>
          <p>
            <span className="font-semibold text-ink">Email:</span>{" "}
            <a
              className="text-leaf hover:underline"
              href="mailto:info@thumeka.co.za"
            >
              info@thumeka.co.za
            </a>
          </p>
          <p>
            <span className="font-semibold text-ink">Phone:</span> 068 756
            2071
          </p>
          <p>
            <span className="font-semibold text-ink">Address:</span> South
            Africa
          </p>
        </div>
        <p className="mt-6 text-body-sm italic text-black/55">
          By registering for an account or using the {APP_NAME} platform,
          you acknowledge that you have read, understood, and agreed to
          these Terms and Conditions.
        </p>
      </section>
    </div>
  );
}

/**
 * Section list reused by the /terms page's table of contents. Kept next to
 * the body so it stays in lockstep with the section ids above.
 */
export const TERMS_SECTIONS: { id: string; title: string }[] = [
  { id: "section-1", title: "1. Introduction" },
  { id: "section-2", title: "2. Definitions" },
  { id: "section-3", title: "3. Eligibility" },
  { id: "section-4", title: "4. Account Registration" },
  { id: "section-5", title: "5. Vetting and Verification" },
  { id: "section-6", title: "6. Marketplace Services" },
  { id: "section-7", title: "7. Product Quality Standards" },
  { id: "section-8", title: "8. Service Standards" },
  { id: "section-9", title: "9. Orders and Payments" },
  { id: "section-10", title: "10. Delivery Services" },
  { id: "section-11", title: "11. Refunds and Returns" },
  { id: "section-12", title: "12. Prohibited Activities" },
  { id: "section-13", title: "13. Ratings and Reviews" },
  { id: "section-14", title: "14. Intellectual Property" },
  { id: "section-15", title: "15. Limitation of Liability" },
  { id: "section-16", title: "16. Indemnity" },
  { id: "section-17", title: "17. Privacy and Data Protection" },
  { id: "section-18", title: "18. Suspension and Termination" },
  { id: "section-19", title: "19. Dispute Resolution" },
  { id: "section-20", title: "20. Amendments" },
  { id: "section-21", title: "21. Governing Law" },
  { id: "section-22", title: "22. Contact Information" }
];
