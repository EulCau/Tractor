#include "card.h"
#include "card.h"

Card::Card(Rank r, Suit s, bool isTrumpR, bool isTrumpS)
	: rank_(r), suit_(s), isTrumpRank_(isTrumpR), isTrumpSuit_(isTrumpS)
{
	effectiveSuit_ = (isTrumpR || isTrumpS) ? TRUMP : s;
	effectiveRank_ = (isTrumpR) ? RANK_TRUMP : r;
}

Rank Card::rank() const
{
	return rank_;
}

Rank Card::effectiveRank() const
{
	return effectiveRank_;
}

Suit Card::suit() const
{
	return suit_;
}

Suit Card::effectiveSuit() const
{
	return effectiveSuit_;
}

bool Card::isTrumpRank() const
{
	return isTrumpRank_;
}

bool Card::isTrumpSuit() const
{
	return isTrumpSuit_;
}

bool Card::isTrumpCard() const
{
	return effectiveSuit_ == TRUMP;
}

void Card::updateEffectiveStatus(Rank trump_r, Suit trump_s)
{
	isTrumpRank_ = (rank_ == trump_r);
	isTrumpSuit_ = (suit_ == trump_s);

	effectiveSuit_ = (isTrumpRank_ || isTrumpSuit_) ? TRUMP : suit_;
	effectiveRank_ = (isTrumpRank_) ? RANK_TRUMP : rank_;
}

CompareResult Card::operator<(const Card& other) const
{
	if (this->effectiveSuit_ != other.effectiveSuit_)
		return DIFFERENT_SUIT;
	return (this->rank_ < other.rank_) ? COMPARE_TRUE : COMPARE_FALSE;
}

CompareResult Card::operator>(const Card& other) const
{
	if (this->effectiveSuit_ != other.effectiveSuit_)
	{
		return DIFFERENT_SUIT;
	}
	return (this->rank_ > other.rank_) ? COMPARE_TRUE : COMPARE_FALSE;
}

CompareResult Card::operator==(const Card& other) const
{
	if (this->effectiveSuit_ != other.effectiveSuit_)
	{
		return DIFFERENT_SUIT;
	}
	return (this->rank_ == other.rank_) ? COMPARE_TRUE : COMPARE_FALSE;
}

CompareResult Card::operator<=(const Card& other) const
{
	if (this->effectiveSuit_ != other.effectiveSuit_)
	{
		return DIFFERENT_SUIT;
	}
	return (this->rank_ <= other.rank_) ? COMPARE_TRUE : COMPARE_FALSE;
}

CompareResult Card::operator>=(const Card& other) const
{
	if (this->effectiveSuit_ != other.effectiveSuit_)
	{
		return DIFFERENT_SUIT;
	}
	return (this->rank_ >= other.rank_) ? COMPARE_TRUE : COMPARE_FALSE;
}

std::string Card::toString() const
{
	return "Card(" + std::to_string(rank_) + ", " + std::to_string(suit_) + ")";
}
