#pragma once

#include <iostream>
#include <string>

enum CompareResult : int8_t
{
	DIFFERENT_SUIT = -1,
	COMPARE_FALSE = 0,
	COMPARE_TRUE = 1
};

// point order (2 to A, with trump using 15 and jokers using 16 & 17)
enum Rank
{
	RANK_2 = 2, RANK_3, RANK_4, RANK_5,
	RANK_6, RANK_7, RANK_8, RANK_9,
	RANK_10, RANK_J, RANK_Q, RANK_K,
	RANK_A, RANK_TRUMP, RANK_SMALL_JOKER, RANK_BIG_JOKER
};

enum Suit
{
	DIAMOND,
	CLUB,
	HEART,
	SPADE,
	TRUMP,
	JOKER
};

class Card
{
public:
	Card(Rank r, Suit s, bool isTrumpR = false, bool isTrumpS = false);

	Rank rank() const;
	Rank effectiveRank() const;

	Suit suit() const;
	Suit effectiveSuit() const;

	bool isTrumpRank() const;
	bool isTrumpSuit() const;
	bool isTrumpCard() const;

	void updateEffectiveStatus(Rank trump_r, Suit trump_s);

	CompareResult operator<(const Card& other) const;
	CompareResult operator>(const Card& other) const;
	CompareResult operator==(const Card& other) const;
	CompareResult operator<=(const Card& other) const;
	CompareResult operator>=(const Card& other) const;

	std::string toString() const;

protected:
	Rank rank_;
	Rank effectiveRank_;

	Suit suit_;
	Suit effectiveSuit_;

	bool isTrumpRank_;
	bool isTrumpSuit_;
};
