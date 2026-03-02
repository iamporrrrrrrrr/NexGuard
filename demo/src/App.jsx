import React, { useEffect, useState } from "react";
import AuditFeed from "./AuditFeed";
import RiskChart from "./RiskChart";
import ProposalCard from "./ProposalCard";

// DevGuard Dashboard — polls /audit/feed every 3s
export default function App() {
  const [auditLogs, setAuditLogs] = useState([]);
  const [riskData, setRiskData] = useState([]);
  const [proposals, setProposals] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const auditResponse = await fetch("/audit/feed");
        const auditData = await auditResponse.json();
        setAuditLogs(auditData);

        const riskResponse = await fetch("/risk/chart");
        const riskData = await riskResponse.json();
        setRiskData(riskData);

        const proposalResponse = await fetch("/proposals/pending");
        const proposalData = await proposalResponse.json();
        setProposals(proposalData);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <h1>DevGuard Dashboard</h1>
      <AuditFeed logs={auditLogs} />
      <RiskChart data={riskData} />
      {proposals.map((proposal) => (
        <ProposalCard key={proposal.id} proposal={proposal} />
      ))}
    </div>
  );
}
