"""Behavioral tests for OfferLock (steward enforcement)."""

import json

import pytest

CONTRACT = "contracts/offer_lock.py"
SDK_VERSION = "v0.2.16"
STAKE = 50_000_000_000_000_000  # 0.05 GEN
MIN_STAKE = 10_000_000_000_000_000
HOSTS = "example.com,github.com"
_DIRECT_VM = None


def _addr_hex(addr) -> str:
    if hasattr(addr, "as_hex"):
        return str(addr.as_hex).lower()
    if isinstance(addr, (bytes, bytearray)):
        return "0x" + bytes(addr).hex().lower()
    text = str(addr).lower()
    if text.startswith("address("):
        start = text.find("0x")
        end = text.rfind('"')
        if start >= 0 and end > start:
            return text[start:end]
    return text


def _verdict(verdict: str, confidence: int = 80) -> str:
    return json.dumps(
        {
            "verdict": verdict,
            "confidence": confidence,
            "reasoning": "Mocked offer arbitration.",
        }
    )


def _web(body: str) -> dict:
    return {"method": "GET", "status": 200, "body": body}


@pytest.fixture
def contract(direct_vm, direct_deploy, direct_alice):
    global _DIRECT_VM
    _DIRECT_VM = direct_vm
    direct_vm.mock_web(r".*", _web("Schedule shows 40 hours, not the 20 hours in the offer."))
    direct_vm.mock_llm(r".*", _verdict("UPHOLD"))
    direct_vm.sender = direct_alice
    return direct_deploy(CONTRACT, sdk_version=SDK_VERSION)


def _payable(contract, method: str, *args, value: int):
    previous = _DIRECT_VM.value
    _DIRECT_VM.value = value
    try:
        return getattr(contract, method)(*args)
    finally:
        _DIRECT_VM.value = previous


def _publish(contract, intern, start_at: int = 1, window: int = 60):
    intern_hex = intern if isinstance(intern, str) else _addr_hex(intern)
    _payable(
        contract,
        "publish_offer",
        intern_hex,
        "Backend intern",
        "Software intern",
        "0.05 GEN/week",
        "20",
        "Remote",
        start_at,
        "Build the public API. No coffee runs.",
        "Weekday slack hours.",
        "https://example.com/offer",
        HOSTS,
        str(STAKE),
        window,
        window,
        value=STAKE * 2,
    )


def _accept(contract, direct_vm, intern):
    direct_vm.sender = intern
    contract.sender = intern
    contract.accept_offer(0)


def _amend_hours(contract, hours: str = "40", value: int = STAKE):
    _payable(
        contract,
        "amend_offer",
        0,
        "Software intern",
        "0.05 GEN/week",
        hours,
        "Remote",
        1,
        "Build the public API. No coffee runs.",
        "Weekday slack hours.",
        "Need more coverage",
        value=value,
    )


def _file(contract, kind: str, amendment_id: int, value: int = STAKE, url: str = "https://example.com/proof"):
    _payable(
        contract,
        "file_claim",
        0,
        kind,
        amendment_id,
        "Terms were changed after I accepted.",
        "Hours doubled without consent.",
        url,
        value=value,
    )


def _expire_response(contract, claim_id: int = 0):
    contract.claims[claim_id].response_deadline_at = contract.claims[claim_id].created_at


def _expire_appeal(contract, claim_id: int = 0):
    contract.claims[claim_id].appeal_deadline_at = contract.claims[claim_id].judged_at


def _judge_breach(contract, direct_vm, claim_id: int = 0):
    _expire_response(contract, claim_id)
    direct_vm.clear_mocks()
    direct_vm.mock_web(r".*", _web("Schedule shows 40 hours, not the 20 hours in the offer."))
    direct_vm.mock_llm(r".*", _verdict("BREACH"))
    contract.judge_claim(claim_id)


def _expire_custody_windows(contract, offer_id: int = 0):
    offer = contract.get_offer(offer_id)
    contract.offers[offer_id].breach_deadline_at = offer["accepted_at"]
    for i in range(int(offer["amendment_count"])):
        contract.amendments[i].challenge_deadline = contract.amendments[i].created_at


def _assert_release_paths_locked(contract, match: str = "open or unpaid"):
    with pytest.raises(Exception, match=match):
        contract.release_performance_bond(0)
    with pytest.raises(Exception, match=match):
        contract.close_offer(0)


class TestPublishAndAccept:
    def test_publish_splits_base_and_performance_bond(self, contract, direct_bob):
        _publish(contract, direct_bob)
        offer = contract.get_offer(0)
        assert offer["status"] == "OPEN"
        assert offer["version"] == 1
        assert offer["base_stake"] == STAKE
        assert offer["performance_bond"] == STAKE
        assert offer["accepted"] is False
        assert offer["intern"].lower() == _addr_hex(direct_bob)
        cfg = contract.get_protocol_config()
        assert cfg["employer_response_window"] == 3 * 24 * 60 * 60

    def test_rejects_self_deal_publish(self, contract, direct_alice):
        with pytest.raises(Exception):
            _publish(contract, direct_alice)

    def test_rejects_low_stake(self, contract, direct_bob):
        with pytest.raises(Exception):
            _payable(
                contract,
                "publish_offer",
                _addr_hex(direct_bob),
                "Role",
                "Intern",
                "1",
                "20",
                "Remote",
                1,
                "Duties",
                "",
                "",
                HOSTS,
                "1",
                60,
                60,
                value=2,
            )

    def test_rejects_localhost_offer_url(self, contract, direct_bob):
        with pytest.raises(Exception):
            _payable(
                contract,
                "publish_offer",
                _addr_hex(direct_bob),
                "Role",
                "Intern",
                "1",
                "20",
                "Remote",
                1,
                "Duties",
                "",
                "http://localhost:3000/offer",
                HOSTS,
                str(STAKE),
                60,
                60,
                value=STAKE * 2,
            )

    def test_accept_pins_version(self, contract, direct_vm, direct_bob):
        _publish(contract, direct_bob)
        _accept(contract, direct_vm, direct_bob)
        offer = contract.get_offer(0)
        assert offer["accepted"] is True
        assert offer["pin_version"] == 1
        assert "hours_per_week=20" in offer["pin_snapshot"]
        assert offer["breach_deadline_at"] >= offer["accepted_at"]

    def test_clock_does_not_start_before_accept(self, contract, direct_bob):
        _publish(contract, direct_bob)
        offer = contract.get_offer(0)
        assert offer["accepted"] is False
        assert offer["accepted_at"] == 0
        assert offer["breach_deadline_at"] == 0
        assert offer["pin_version"] == 0

    def test_windows_are_clamped_to_minimum(self, contract, direct_bob):
        _publish(contract, direct_bob)
        offer = contract.get_offer(0)
        cfg = contract.get_protocol_config()
        assert offer["breach_window_seconds"] >= cfg["min_window"]
        assert offer["amend_window_seconds"] >= cfg["min_window"]
        assert cfg["min_window"] >= 3600

    def test_stranger_cannot_accept(self, contract, direct_vm, direct_bob, direct_charlie):
        _publish(contract, direct_bob)
        direct_vm.sender = direct_charlie
        with pytest.raises(Exception):
            contract.accept_offer(0)


class TestAmendClassification:
    def test_material_amend_opens_window_and_keeps_pin(self, contract, direct_vm, direct_alice, direct_bob):
        _publish(contract, direct_bob)
        _accept(contract, direct_vm, direct_bob)
        direct_vm.sender = direct_alice
        _amend_hours(contract, "40")
        offer = contract.get_offer(0)
        amend = contract.get_amendment(0)
        assert offer["version"] == 2
        assert offer["pin_version"] == 1
        assert "hours_per_week=20" in offer["pin_snapshot"]
        assert offer["hours_per_week"] == "40"
        assert offer["base_stake"] == STAKE
        assert amend["kind"] == "MATERIAL"
        assert amend["stake"] == STAKE
        assert int(amend["challenge_deadline"]) > int(amend["created_at"])

    def test_clarification_has_no_collateral(self, contract, direct_vm, direct_alice, direct_bob):
        _publish(contract, direct_bob)
        _accept(contract, direct_vm, direct_bob)
        direct_vm.sender = direct_alice
        contract.amend_offer(
            0,
            "Software intern",
            "0.05 GEN/week",
            "20",
            "Remote",
            1,
            "Build the public API. No coffee runs.",
            "Please use the #intern channel.",
            "Clarify slack channel",
        )
        offer = contract.get_offer(0)
        amend = contract.get_amendment(0)
        assert offer["version"] == 1
        assert amend["kind"] == "CLARIFICATION"
        assert amend["stake"] == 0
        assert amend["collateral_released"] is True

    def test_cannot_amend_before_accept(self, contract, direct_bob):
        _publish(contract, direct_bob)
        with pytest.raises(Exception):
            _amend_hours(contract)

    def test_cannot_amend_during_open_claim(self, contract, direct_vm, direct_alice, direct_bob):
        _publish(contract, direct_bob)
        _accept(contract, direct_vm, direct_bob)
        direct_vm.sender = direct_alice
        _amend_hours(contract)
        direct_vm.sender = direct_bob
        _file(contract, "AMEND", 0)
        direct_vm.sender = direct_alice
        with pytest.raises(Exception):
            _amend_hours(contract, "45")


class TestWhoCanClaim:
    def test_unenrolled_cannot_claim(self, contract, direct_vm, direct_bob, direct_charlie):
        _publish(contract, direct_bob)
        _accept(contract, direct_vm, direct_bob)
        direct_vm.sender = direct_charlie
        with pytest.raises(Exception):
            _file(contract, "BREACH", 0)

    def test_employer_cannot_self_claim(self, contract, direct_vm, direct_alice, direct_bob):
        _publish(contract, direct_bob)
        _accept(contract, direct_vm, direct_bob)
        direct_vm.sender = direct_alice
        with pytest.raises(Exception):
            _file(contract, "BREACH", 0)

    def test_rejects_unverified_host(self, contract, direct_vm, direct_bob):
        _publish(contract, direct_bob)
        _accept(contract, direct_vm, direct_bob)
        with pytest.raises(Exception):
            _file(contract, "BREACH", 0, url="https://evil.example.org/fake")

    def test_rejects_private_evidence_url(self, contract, direct_vm, direct_bob):
        _publish(contract, direct_bob)
        _accept(contract, direct_vm, direct_bob)
        with pytest.raises(Exception):
            _file(contract, "BREACH", 0, url="http://127.0.0.1/proof")

    def test_claim_stake_must_match_item(self, contract, direct_vm, direct_alice, direct_bob):
        _publish(contract, direct_bob)
        _accept(contract, direct_vm, direct_bob)
        direct_vm.sender = direct_alice
        _amend_hours(contract, value=STAKE)
        direct_vm.sender = direct_bob
        with pytest.raises(Exception):
            _file(contract, "AMEND", 0, value=MIN_STAKE)

    def test_one_open_claim(self, contract, direct_vm, direct_alice, direct_bob):
        _publish(contract, direct_bob)
        _accept(contract, direct_vm, direct_bob)
        direct_vm.sender = direct_alice
        _amend_hours(contract)
        direct_vm.sender = direct_bob
        _file(contract, "AMEND", 0)
        with pytest.raises(Exception):
            _file(contract, "BREACH", 0)

    def test_leave_then_claim_reverts(self, contract, direct_vm, direct_alice, direct_bob):
        _publish(contract, direct_bob)
        _accept(contract, direct_vm, direct_bob)
        contract.leave_offer(0)
        with pytest.raises(Exception):
            _file(contract, "BREACH", 0)

    def test_leave_does_not_skip_bond_release_or_close(self, contract, direct_vm, direct_alice, direct_bob):
        _publish(contract, direct_bob)
        _accept(contract, direct_vm, direct_bob)
        contract.leave_offer(0)
        direct_vm.sender = direct_alice
        with pytest.raises(Exception):
            contract.release_performance_bond(0)
        with pytest.raises(Exception):
            contract.close_offer(0)
        offer = contract.get_offer(0)
        contract.offers[0].breach_deadline_at = offer["accepted_at"]
        contract.release_performance_bond(0)
        contract.close_offer(0)
        assert contract.get_offer(0)["closed"] is True

    def test_leave_does_not_skip_amendment_window(self, contract, direct_vm, direct_alice, direct_bob):
        _publish(contract, direct_bob)
        _accept(contract, direct_vm, direct_bob)
        direct_vm.sender = direct_alice
        _amend_hours(contract)
        direct_vm.sender = direct_bob
        contract.leave_offer(0)
        direct_vm.sender = direct_alice
        with pytest.raises(Exception):
            contract.release_amendment_collateral(0)
        with pytest.raises(Exception):
            contract.close_offer(0)
        offer = contract.get_offer(0)
        contract.offers[0].breach_deadline_at = offer["accepted_at"]
        contract.amendments[0].challenge_deadline = contract.amendments[0].created_at
        contract.release_amendment_collateral(0)
        assert contract.get_amendment(0)["collateral_released"] is True
        contract.close_offer(0)
        assert contract.get_offer(0)["closed"] is True


class TestJudgeDueProcess:
    def test_cannot_judge_before_response_window(self, contract, direct_vm, direct_alice, direct_bob):
        _publish(contract, direct_bob)
        _accept(contract, direct_vm, direct_bob)
        _file(contract, "BREACH", 0)
        with pytest.raises(Exception):
            contract.judge_claim(0)

    def test_judge_after_reply(self, contract, direct_vm, direct_alice, direct_bob):
        _publish(contract, direct_bob)
        _accept(contract, direct_vm, direct_bob)
        _file(contract, "BREACH", 0)
        direct_vm.sender = direct_alice
        contract.respond_to_claim(0, "Hours stayed at 20; the screenshot is a draft.")
        direct_vm.mock_llm(r".*", _verdict("UPHOLD"))
        contract.judge_claim(0)
        claim = contract.get_claim(0)
        assert claim["status"] == "JUDGED"
        assert claim["verdict"] == "UPHOLD"
        assert claim["paid_out"] is False
        assert claim["judged_without_employer_response"] is False

    def test_judge_after_window_without_reply(self, contract, direct_vm, direct_bob):
        _publish(contract, direct_bob)
        _accept(contract, direct_vm, direct_bob)
        _file(contract, "BREACH", 0)
        _expire_response(contract)
        direct_vm.clear_mocks()
        direct_vm.mock_web(r".*", _web("Schedule shows 40 hours, not the 20 hours in the offer."))
        direct_vm.mock_llm(r".*", _verdict("BREACH"))
        contract.judge_claim(0)
        claim = contract.get_claim(0)
        ledger = contract.get_fairness_ledger()
        assert claim["verdict"] == "BREACH"
        assert claim["judged_without_employer_response"] is True
        assert ledger["breach"] == 1
        assert ledger["judged_without_employer_response"] == 1

    def test_third_party_judge_does_not_take_pot(self, contract, direct_vm, direct_bob, direct_charlie):
        _publish(contract, direct_bob)
        _accept(contract, direct_vm, direct_bob)
        _file(contract, "BREACH", 0)
        _expire_response(contract)
        direct_vm.sender = direct_charlie
        contract.judge_claim(0)
        claim = contract.get_claim(0)
        offer = contract.get_offer(0)
        assert claim["status"] == "JUDGED"
        assert claim["paid_out"] is False
        assert offer["base_stake"] == STAKE


class TestEvidenceAndMoney:
    def test_fetch_fail_is_inconclusive_refund(self, contract, direct_vm, direct_alice, direct_bob):
        _publish(contract, direct_bob)
        _accept(contract, direct_vm, direct_bob)
        _file(contract, "BREACH", 0)
        _expire_response(contract)
        direct_vm.clear_mocks()
        direct_vm.mock_web(r".*", _web(""))
        direct_vm.mock_llm(r".*", _verdict("BREACH"))
        contract.judge_claim(0)
        claim = contract.get_claim(0)
        assert claim["verdict"] == "INCONCLUSIVE"
        _expire_appeal(contract)
        contract.settle_claim(0)
        settled = contract.get_claim(0)
        offer = contract.get_offer(0)
        assert settled["paid_out"] is True
        assert settled["status"] == "SETTLED"
        assert offer["performance_bond"] == 0
        assert offer["base_stake"] == STAKE

    def test_amend_claim_does_not_touch_base_or_bond(self, contract, direct_vm, direct_alice, direct_bob):
        _publish(contract, direct_bob)
        _accept(contract, direct_vm, direct_bob)
        direct_vm.sender = direct_alice
        _amend_hours(contract)
        direct_vm.sender = direct_bob
        _file(contract, "AMEND", 0)
        _expire_response(contract)
        direct_vm.clear_mocks()
        direct_vm.mock_web(r".*", _web("Hours jumped from 20 to 40 after accept."))
        direct_vm.mock_llm(r".*", _verdict("BREACH"))
        contract.judge_claim(0)
        _expire_appeal(contract)
        contract.settle_claim(0)
        offer = contract.get_offer(0)
        amend = contract.get_amendment(0)
        assert offer["base_stake"] == STAKE
        assert offer["performance_bond"] == STAKE
        assert amend["stake"] == 0
        assert amend["collateral_released"] is True

    def test_pin_survives_material_amend(self, contract, direct_vm, direct_alice, direct_bob):
        _publish(contract, direct_bob)
        _accept(contract, direct_vm, direct_bob)
        pin = contract.get_offer(0)["pin_snapshot"]
        direct_vm.sender = direct_alice
        _amend_hours(contract, "40")
        assert contract.get_offer(0)["pin_snapshot"] == pin
        assert "hours_per_week=20" in pin


class TestWindowsAndClose:
    def test_cannot_close_during_breach_window(self, contract, direct_vm, direct_alice, direct_bob):
        _publish(contract, direct_bob)
        _accept(contract, direct_vm, direct_bob)
        direct_vm.sender = direct_alice
        with pytest.raises(Exception):
            contract.close_offer(0)

    def test_cannot_close_during_open_claim(self, contract, direct_vm, direct_alice, direct_bob):
        _publish(contract, direct_bob)
        _accept(contract, direct_vm, direct_bob)
        _file(contract, "BREACH", 0)
        direct_vm.sender = direct_alice
        with pytest.raises(Exception):
            contract.close_offer(0)

    def test_release_and_close_after_windows(self, contract, direct_vm, direct_alice, direct_bob):
        _publish(contract, direct_bob)
        _accept(contract, direct_vm, direct_bob)
        offer = contract.get_offer(0)
        contract.offers[0].breach_deadline_at = offer["accepted_at"]
        direct_vm.sender = direct_alice
        contract.release_performance_bond(0)
        contract.close_offer(0)
        closed = contract.get_offer(0)
        assert closed["closed"] is True
        assert closed["status"] == "CLOSED"
        assert closed["base_stake"] == 0
        assert closed["performance_bond"] == 0

    def test_second_appeal_reverts(self, contract, direct_vm, direct_alice, direct_bob):
        _publish(contract, direct_bob)
        _accept(contract, direct_vm, direct_bob)
        _file(contract, "BREACH", 0)
        _expire_response(contract)
        direct_vm.clear_mocks()
        direct_vm.mock_web(r".*", _web("Schedule shows 40 hours, not the 20 hours in the offer."))
        direct_vm.mock_llm(r".*", _verdict("BREACH"))
        contract.judge_claim(0)
        direct_vm.sender = direct_alice
        _payable(contract, "appeal_claim", 0, "Hours were always 20", value=STAKE)
        with pytest.raises(Exception):
            _payable(contract, "appeal_claim", 0, "Again", value=STAKE)

    def test_first_verdict_is_immutable_on_appeal(self, contract, direct_vm, direct_alice, direct_bob):
        _publish(contract, direct_bob)
        _accept(contract, direct_vm, direct_bob)
        _file(contract, "BREACH", 0)
        _expire_response(contract)
        direct_vm.clear_mocks()
        direct_vm.mock_web(r".*", _web("Schedule shows 40 hours, not the 20 hours in the offer."))
        direct_vm.mock_llm(r".*", _verdict("BREACH"))
        contract.judge_claim(0)
        first = contract.get_claim(0)
        direct_vm.sender = direct_alice
        _payable(contract, "appeal_claim", 0, "Hours were always 20", value=STAKE)
        direct_vm.clear_mocks()
        direct_vm.mock_web(r".*", _web("The intern misunderstood a draft calendar."))
        direct_vm.mock_llm(r".*", _verdict("UPHOLD"))
        contract.judge_appeal(0)
        claim = contract.get_claim(0)
        assert first["verdict"] == "BREACH"
        assert first["reasoning"]
        assert claim["verdict"] == "BREACH"
        assert claim["reasoning"] == first["reasoning"]
        assert claim["appeal_verdict"] == "UPHOLD"
        assert claim["appeal_reasoning"]
        assert claim["status"] == "SETTLED"
        assert claim["paid_out"] is True
        ledger = contract.get_fairness_ledger()
        assert ledger["breach"] == 1
        assert ledger["uphold"] == 0

    def test_cannot_file_after_amend_window(self, contract, direct_vm, direct_alice, direct_bob):
        _publish(contract, direct_bob)
        _accept(contract, direct_vm, direct_bob)
        direct_vm.sender = direct_alice
        _amend_hours(contract)
        contract.amendments[0].challenge_deadline = contract.amendments[0].created_at
        direct_vm.sender = direct_bob
        with pytest.raises(Exception):
            _file(contract, "AMEND", 0)

    def test_cannot_release_or_close_judged_unpaid_claim(self, contract, direct_vm, direct_alice, direct_bob):
        _publish(contract, direct_bob)
        _accept(contract, direct_vm, direct_bob)
        _file(contract, "BREACH", 0)
        _judge_breach(contract, direct_vm)
        _expire_custody_windows(contract)
        offer = contract.get_offer(0)
        claim = contract.get_claim(0)
        assert offer["has_open_claim"] is True
        assert claim["status"] == "JUDGED"
        assert claim["paid_out"] is False
        direct_vm.sender = direct_alice
        _assert_release_paths_locked(contract)
        _expire_appeal(contract)
        _assert_release_paths_locked(contract)
        contract.settle_claim(0)
        settled_offer = contract.get_offer(0)
        assert settled_offer["has_open_claim"] is False
        assert contract.get_claim(0)["paid_out"] is True
        contract.close_offer(0)
        assert contract.get_offer(0)["closed"] is True

    def test_cannot_release_or_close_during_open_appeal(self, contract, direct_vm, direct_alice, direct_bob):
        _publish(contract, direct_bob)
        _accept(contract, direct_vm, direct_bob)
        _file(contract, "BREACH", 0)
        _judge_breach(contract, direct_vm)
        _expire_custody_windows(contract)
        direct_vm.sender = direct_alice
        _payable(contract, "appeal_claim", 0, "Hours were always 20", value=STAKE)
        assert contract.get_offer(0)["has_open_claim"] is True
        assert contract.get_claim(0)["appealed"] is True
        assert contract.get_claim(0)["paid_out"] is False
        _assert_release_paths_locked(contract)
        direct_vm.clear_mocks()
        direct_vm.mock_web(r".*", _web("The intern misunderstood a draft calendar."))
        direct_vm.mock_llm(r".*", _verdict("UPHOLD"))
        contract.judge_appeal(0)
        assert contract.get_offer(0)["has_open_claim"] is False
        assert contract.get_claim(0)["paid_out"] is True
        contract.close_offer(0)
        assert contract.get_offer(0)["closed"] is True

    def test_cannot_release_amendment_or_close_judged_unpaid_claim(
        self, contract, direct_vm, direct_alice, direct_bob
    ):
        _publish(contract, direct_bob)
        _accept(contract, direct_vm, direct_bob)
        direct_vm.sender = direct_alice
        _amend_hours(contract)
        direct_vm.sender = direct_bob
        _file(contract, "AMEND", 0)
        _judge_breach(contract, direct_vm)
        _expire_custody_windows(contract)
        claim = contract.get_claim(0)
        assert contract.get_offer(0)["has_open_claim"] is True
        assert claim["status"] == "JUDGED"
        assert claim["paid_out"] is False
        direct_vm.sender = direct_alice
        with pytest.raises(Exception, match="open or unpaid"):
            contract.release_amendment_collateral(0)
        _assert_release_paths_locked(contract)
        _expire_appeal(contract)
        with pytest.raises(Exception, match="open or unpaid"):
            contract.release_amendment_collateral(0)
        _assert_release_paths_locked(contract)
        contract.settle_claim(0)
        assert contract.get_offer(0)["has_open_claim"] is False
        assert contract.get_claim(0)["paid_out"] is True
        contract.close_offer(0)
        assert contract.get_offer(0)["closed"] is True

    def test_cannot_release_amendment_or_close_during_open_appeal(
        self, contract, direct_vm, direct_alice, direct_bob
    ):
        _publish(contract, direct_bob)
        _accept(contract, direct_vm, direct_bob)
        direct_vm.sender = direct_alice
        _amend_hours(contract)
        direct_vm.sender = direct_bob
        _file(contract, "AMEND", 0)
        _judge_breach(contract, direct_vm)
        _expire_custody_windows(contract)
        direct_vm.sender = direct_alice
        _payable(contract, "appeal_claim", 0, "Hours were always 20", value=STAKE)
        assert contract.get_offer(0)["has_open_claim"] is True
        assert contract.get_claim(0)["appealed"] is True
        assert contract.get_claim(0)["paid_out"] is False
        with pytest.raises(Exception, match="open or unpaid"):
            contract.release_amendment_collateral(0)
        _assert_release_paths_locked(contract)
        direct_vm.clear_mocks()
        direct_vm.mock_web(r".*", _web("The intern misunderstood a draft calendar."))
        direct_vm.mock_llm(r".*", _verdict("UPHOLD"))
        contract.judge_appeal(0)
        assert contract.get_offer(0)["has_open_claim"] is False
        assert contract.get_claim(0)["paid_out"] is True
        contract.close_offer(0)
        assert contract.get_offer(0)["closed"] is True

    def test_cannot_release_bond_before_window(self, contract, direct_vm, direct_alice, direct_bob):
        _publish(contract, direct_bob)
        _accept(contract, direct_vm, direct_bob)
        direct_vm.sender = direct_alice
        with pytest.raises(Exception):
            contract.release_performance_bond(0)

    def test_cannot_release_amendment_before_window(self, contract, direct_vm, direct_alice, direct_bob):
        _publish(contract, direct_bob)
        _accept(contract, direct_vm, direct_bob)
        direct_vm.sender = direct_alice
        _amend_hours(contract)
        with pytest.raises(Exception):
            contract.release_amendment_collateral(0)
